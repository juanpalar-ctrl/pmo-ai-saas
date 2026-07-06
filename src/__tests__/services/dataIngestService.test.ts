import { DataIngestService } from '../../services/dataIngestService';
import { IDataAdapter } from '../../services/adapters/IDataAdapter';

jest.mock('../../repositories/projectRepository', () => ({
  projectRepository: { saveProject: jest.fn() },
}));
jest.mock('../../core/logger', () => ({
  serviceLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { projectRepository } from '../../repositories/projectRepository';

const mockSaveProject = projectRepository.saveProject as jest.Mock;

describe('DataIngestService.ingestFromAdapter', () => {
  let service: DataIngestService;

  beforeEach(() => {
    service = new DataIngestService();
    mockSaveProject.mockReset();
  });

  it('saves every project read from the adapter and returns the count', async () => {
    const adapter: IDataAdapter = {
      name: 'test-adapter',
      read: jest.fn().mockResolvedValue([{ project_name: 'A' }, { project_name: 'B' }]),
      validate: jest.fn(),
    };
    mockSaveProject.mockResolvedValue(undefined);

    const result = await service.ingestFromAdapter(adapter, 'user-1');

    expect(result).toEqual({ count: 2, rejected: 0 });
    expect(mockSaveProject).toHaveBeenCalledTimes(2);
    expect(mockSaveProject).toHaveBeenNthCalledWith(1, { project_name: 'A' }, 'user-1');
  });

  it('reports rejectedCount from the adapter when present', async () => {
    const adapter: any = {
      name: 'test-adapter',
      read: jest.fn().mockResolvedValue([{ project_name: 'A' }]),
      validate: jest.fn(),
      rejectedCount: 3,
    };
    mockSaveProject.mockResolvedValue(undefined);

    const result = await service.ingestFromAdapter(adapter, 'user-1');

    expect(result).toEqual({ count: 1, rejected: 3 });
  });

  it('propagates errors from adapter.read()', async () => {
    const adapter: IDataAdapter = {
      name: 'broken-adapter',
      read: jest.fn().mockRejectedValue(new Error('bad file')),
      validate: jest.fn(),
    };

    await expect(service.ingestFromAdapter(adapter, 'user-1')).rejects.toThrow('bad file');
    expect(mockSaveProject).not.toHaveBeenCalled();
  });

  it('propagates errors from projectRepository.saveProject', async () => {
    const adapter: IDataAdapter = {
      name: 'test-adapter',
      read: jest.fn().mockResolvedValue([{ project_name: 'A' }]),
      validate: jest.fn(),
    };
    mockSaveProject.mockRejectedValueOnce(new Error('db down'));

    await expect(service.ingestFromAdapter(adapter, 'user-1')).rejects.toThrow('db down');
  });
});

describe('DataIngestService.ingestFromAdapterWithDetails', () => {
  let service: DataIngestService;

  beforeEach(() => {
    service = new DataIngestService();
    mockSaveProject.mockReset();
  });

  it('throws when the adapter does not implement readWithDetails', async () => {
    const adapter: IDataAdapter = {
      name: 'no-details-adapter',
      read: jest.fn(),
      validate: jest.fn(),
    };

    await expect(service.ingestFromAdapterWithDetails(adapter, 'user-1'))
      .rejects.toThrow(/readWithDetails/);
  });

  it('saves only valid projects and formats rejection reasons per row', async () => {
    const adapter: any = {
      name: 'details-adapter',
      readWithDetails: jest.fn().mockResolvedValue({
        validProjects: [{ project_name: 'A' }],
        rejectedRows: [
          { rowIndex: 2, errors: ['Missing project_name'] },
          { rowIndex: 5, errors: ['Invalid cost', 'Invalid date'] },
        ],
      }),
    };
    mockSaveProject.mockResolvedValue(undefined);

    const result = await service.ingestFromAdapterWithDetails(adapter, 'user-1');

    expect(result.count).toBe(1);
    expect(result.rejected).toBe(2);
    expect(result.rejectionReasons).toEqual([
      'Fila 2: Missing project_name',
      'Fila 5: Invalid cost',
      'Fila 5: Invalid date',
    ]);
    expect(mockSaveProject).toHaveBeenCalledTimes(1);
    expect(mockSaveProject).toHaveBeenCalledWith({ project_name: 'A' }, 'user-1');
  });

  it('returns an empty rejectionReasons array when nothing was rejected', async () => {
    const adapter: any = {
      name: 'clean-adapter',
      readWithDetails: jest.fn().mockResolvedValue({
        validProjects: [{ project_name: 'A' }, { project_name: 'B' }],
        rejectedRows: [],
      }),
    };
    mockSaveProject.mockResolvedValue(undefined);

    const result = await service.ingestFromAdapterWithDetails(adapter, 'user-1');

    expect(result).toEqual({ count: 2, rejected: 0, rejectionReasons: [] });
  });
});
