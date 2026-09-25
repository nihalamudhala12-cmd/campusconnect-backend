/**
 * Sample Service
 * Step 6.7 — API Foundation Verification
 *
 * Demonstrates the Controller → Service → Repository flow.
 * Contains business logic and orchestrates repository calls.
 * Uses transaction support via connection.withTransaction.
 */

const { BadRequestError, NotFoundError, ForbiddenError } = require('../../errors');

class SampleService {
  constructor(sampleRepository, connection) {
    this.sampleRepository = sampleRepository;
    this.connection = connection;
  }

  async getSample(id, departmentId) {
    const sample = await this.sampleRepository.findSample(id);
    if (!sample) {
      throw new NotFoundError('Sample not found');
    }
    if (departmentId !== 'ALL' && sample.department_id !== departmentId) {
      throw new ForbiddenError('Access denied to this sample');
    }
    return sample;
  }

  async getSamples(departmentId) {
    return this.sampleRepository.findSamplesByDepartment(departmentId);
  }

  async createSample(data, departmentId) {
    if (!data.name) {
      throw new BadRequestError('Name is required');
    }
    return this.connection.withTransaction(async (client) => {
      const sample = await this.sampleRepository.createSample(
        { name: data.name, departmentId: data.departmentId || departmentId, status: data.status },
        client
      );
      return sample;
    });
  }

  async updateSample(id, data, departmentId) {
    const existing = await this.sampleRepository.findSample(id);
    if (!existing) {
      throw new NotFoundError('Sample not found');
    }
    if (departmentId !== 'ALL' && existing.department_id !== departmentId) {
      throw new ForbiddenError('Access denied to this sample');
    }
    return this.sampleRepository.updateSample(id, data, null);
  }

  async deleteSample(id, departmentId) {
    const existing = await this.sampleRepository.findSample(id);
    if (!existing) {
      throw new NotFoundError('Sample not found');
    }
    if (departmentId !== 'ALL' && existing.department_id !== departmentId) {
      throw new ForbiddenError('Access denied to this sample');
    }
    return this.sampleRepository.deleteSample(id, null);
  }
}

module.exports = SampleService;
