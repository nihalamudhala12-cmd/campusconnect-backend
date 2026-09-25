/**
 * AI Orchestrator Service
 * Core orchestration logic for the AI assistant.
 * Uses trusted application context built from the authenticated user.
 * Uses a local response engine — no external AI provider dependency.
 * Never trusts browser-supplied authorization data.
 */

const AIContextBuilder = require('./aiContextBuilder');

class AIOrchestrator {
  constructor(options = {}) {
    this.toolRegistry = options.toolRegistry || [];
  }

  async processChat(user, message, requestContext = {}) {
    if (!user) {
      throw new Error('User authentication required');
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new Error('Message is required');
    }

    const contextBuilder = new AIContextBuilder(user, requestContext);
    const context = contextBuilder.build();

    if (!context) {
      throw new Error('Failed to build trusted AI context');
    }

    const availableTools = this._getAvailableTools(context);

    const conversation = requestContext.conversation || [];
    const messages = [...conversation, { role: 'user', content: message }];

    let finalMessage;
    let toolResults = [];
    let usedTools = [];

    const intent = this._classifyIntent(message);

    if (intent.tools && intent.tools.length > 0) {
      for (const toolName of intent.tools) {
        const tool = this.toolRegistry.find((t) => t.name === toolName);
        if (tool) {
          const roleValidation = this._validateToolRoleAccess(tool, context.role);
          if (roleValidation.valid) {
            try {
              const result = await tool.execute({}, context.user);
              toolResults.push({
                toolName: toolName,
                success: true,
                result: result,
              });
              usedTools.push(toolName);
            } catch (error) {
              toolResults.push({
                toolName: toolName,
                success: false,
                error: error.message || 'Tool execution failed',
                errorCode: 'TOOL_EXECUTION_ERROR',
              });
            }
          }
        }
      }

      finalMessage = this._formatToolResponse(toolResults, context);
    } else {
      finalMessage = this._getLocalResponse(intent.type, message, context);
    }

    return {
      success: true,
      data: {
        message: finalMessage,
        sources: this._extractSources(toolResults),
        usedTools: usedTools,
        context: { module: context.module, scope: context.role },
        toolResults: toolResults,
      },
      usage: {
        tokensUsed: {},
        latencyMs: Date.now() - (requestContext._startedAt || Date.now()),
      },
    };
  }

  async processChatSimple(user, message, requestContext = {}) {
    if (!user) {
      throw new Error('User authentication required');
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new Error('Message is required');
    }

    const contextBuilder = new AIContextBuilder(user, requestContext);
    const context = contextBuilder.build();

    if (!context) {
      throw new Error('Failed to build trusted AI context');
    }

    const availableTools = this._getAvailableTools(context);

    const intent = this._classifyIntent(message);

    let finalMessage;
    let toolResults = [];

    if (intent.tools && intent.tools.length > 0) {
      for (const toolName of intent.tools) {
        const tool = this.toolRegistry.find((t) => t.name === toolName);
        if (tool) {
          const roleValidation = this._validateToolRoleAccess(tool, context.role);
          if (roleValidation.valid) {
            try {
              const result = await tool.execute({}, context.user);
              toolResults.push({
                toolName: toolName,
                success: true,
                result: result,
              });
            } catch (error) {
              toolResults.push({
                toolName: toolName,
                success: false,
                error: error.message || 'Tool execution failed',
                errorCode: 'TOOL_EXECUTION_ERROR',
              });
            }
          }
        }
      }

      finalMessage = this._formatToolResponse(toolResults, context);
    } else {
      finalMessage = this._getLocalResponse(intent.type, message, context);
    }

    return {
      success: true,
      data: {
        message: finalMessage,
        sources: this._extractSources(toolResults),
        usedTools: toolResults.map((r) => r.toolName),
        context: { module: context.module, scope: context.role },
        toolResults: toolResults,
      },
      usage: {
        tokensUsed: {},
        latencyMs: Date.now() - (requestContext._startedAt || Date.now()),
      },
    };
  }

  _classifyIntent(message) {
    const lower = message.toLowerCase();

    const intentMap = [
      {
        keywords: ['announcement', 'announcements', 'notice', 'notices'],
        tools: ['get_user_announcements'],
        type: 'announcements',
      },
      {
        keywords: ['attendance', 'absent', 'present'],
        tools: ['get_user_attendance'],
        type: 'attendance',
      },
      {
        keywords: ['class', 'classes', 'schedule', 'timetable'],
        tools: ['get_user_classes'],
        type: 'classes',
      },
      {
        keywords: ['result', 'results', 'grade', 'grades', 'marks'],
        tools: ['get_user_results'],
        type: 'results',
      },
      {
        keywords: ['approval', 'approvals', 'pending', 'request'],
        tools: ['get_user_approvals'],
        type: 'approvals',
      },
      {
        keywords: ['message', 'messages', 'inbox', 'notification', 'notifications'],
        tools: ['get_user_messages', 'get_user_notifications'],
        type: 'messages',
      },
      {
        keywords: ['department', 'departments'],
        tools: ['get_departments'],
        type: 'departments',
      },
      {
        keywords: ['analytic', 'analytics', 'report', 'stat'],
        tools: ['get_user_analytics'],
        type: 'analytics',
      },
      {
        keywords: ['profile', 'me', 'my account', 'account'],
        tools: ['get_user_profile'],
        type: 'profile',
      },
    ];

    for (const entry of intentMap) {
      if (entry.keywords.some((kw) => lower.includes(kw))) {
        return { type: entry.type, tools: entry.tools, message: message };
      }
    }

    return { type: 'general', tools: [], message: message };
  }

  _getAvailableTools(context) {
    const role = context.role;
    return this.toolRegistry.filter((tool) => {
      if (role === 'PRINCIPAL') {
        return true;
      }
      const allowedRoles = tool.roleScope || [];
      return allowedRoles.indexOf(role) !== -1;
    });
  }

  _validateToolRoleAccess(tool, role) {
    const allowedRoles = tool.roleScope || [];
    if (role === 'PRINCIPAL') {
      return { valid: true };
    }
    if (allowedRoles.indexOf(role) !== -1) {
      return { valid: true };
    }
    return { valid: false, message: 'Tool ' + tool.name + ' not authorized for role ' + role };
  }

  _formatToolResponse(toolResults, context) {
    const successful = toolResults.filter((r) => r.success && r.result);
    const failed = toolResults.filter((r) => !r.success);

    if (successful.length === 0 && failed.length > 0) {
      return 'I was unable to retrieve that information at this time. Some requested data sources were unavailable.';
    }

    let response = 'Here is the information you requested:\n\n';
    let first = true;

    for (const result of successful) {
      if (!first) response += '\n';
      first = false;

      response += this._formatToolResult(result.toolName, result.result, context);
    }

    if (failed.length > 0) {
      response += '\n\nNote: ' + failed.length + ' tool(s) could not be executed.';
    }

    return response;
  }

  _formatToolResult(toolName, result, context) {
    if (!result) {
      return toolName + ': No data available.';
    }

    if (Array.isArray(result)) {
      if (result.length === 0) {
        return toolName + ': No records found.';
      }
      return toolName + ': ' + JSON.stringify(result, null, 2);
    }

    if (typeof result === 'object') {
      const entries = Object.entries(result)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => k + ': ' + (v !== null && v !== undefined ? String(v) : 'N/A'))
        .join(', ');
      return toolName + ': ' + entries;
    }

    return toolName + ': ' + String(result);
  }

  _getLocalResponse(type, message, context) {
    const role = context.role;
    const department = context.department ? 'your department (' + context.department + ')' : 'your department';
    const roleLabel = role.toLowerCase();

    const responses = {
      general:
        'Hello! I am the CampusConnect AI Assistant. I can help you with information about ' +
        'announcements, attendance, classes, results, approvals, messages, departments, ' +
        'analytics, and your profile. Please let me know what you would like to check. ' +
        'You are currently viewing as ' + roleLabel + ' for ' + department + '.',
      announcements:
        'Fetching your announcements... I can retrieve recent announcements relevant to your role (' + roleLabel + ') and department (' + department + ').',
      attendance:
        'Fetching your attendance records... I can look up attendance data for your role (' + roleLabel + ') and department (' + department + ').',
      classes:
        'Fetching your class schedule... I can retrieve class information for your role (' + roleLabel + ') and department (' + department + ').',
      results:
        'Fetching your results... I can access result records for your role (' + roleLabel + ') and department (' + department + ').',
      approvals:
        'Fetching approval requests... I can retrieve pending approvals for your role (' + roleLabel + ') and department (' + department + ').',
      messages:
        'Fetching your messages and notifications... I can retrieve these for your role (' + roleLabel + ') and department (' + department + ').',
      departments:
        'Fetching department information... I can list departments accessible to your role (' + roleLabel + ').',
      analytics:
        'Fetching analytics data... I can retrieve analytics for your role (' + roleLabel + ') and department (' + department + ').',
      profile:
        'Here is your profile information. I can provide details about your role (' + roleLabel + ') and department (' + department + ') as part of the authenticated session context.',
    };

    return responses[type] || responses.general;
  }

  _extractSources(toolResults) {
    return toolResults
      .filter((r) => r.success && r.result)
      .map((r) => ({ tool: r.toolName, status: 'success' }));
  }
}

module.exports = AIOrchestrator;
