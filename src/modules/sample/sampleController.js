/**
 * Sample Controller
 * Step 6.7 — API Foundation Verification
 *
 * Demonstrates the Controller → Service → Repository flow.
 * Translates HTTP requests into service calls and formats responses.
 */

const { ValidationError } = require('../../errors');

class SampleController {
  constructor(sampleService) {
    this.sampleService = sampleService;
  }

  async getSample(req, res) {
    const { id } = req.params;
    const sample = await this.sampleService.getSample(id, req.departmentId);
    return res.json({ success: true, data: sample });
  }

  async getSamples(req, res) {
    const samples = await this.sampleService.getSamples(req.departmentId);
    return res.json({ success: true, data: samples });
  }

  async createSample(req, res) {
    const errors = [];
    if (!req.body || !req.body.name) {
      errors.push({ field: 'name', message: 'Name is required' });
    }
    if (errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }
    const sample = await this.sampleService.createSample(req.body, req.departmentId);
    return res.status(201).json({ success: true, data: sample });
  }

  async updateSample(req, res) {
    const { id } = req.params;
    const sample = await this.sampleService.updateSample(id, req.body, req.departmentId);
    return res.json({ success: true, data: sample });
  }

  async deleteSample(req, res) {
    const { id } = req.params;
    const result = await this.sampleService.deleteSample(id, req.departmentId);
    return res.json({ success: true, data: result });
  }
}

module.exports = SampleController;
