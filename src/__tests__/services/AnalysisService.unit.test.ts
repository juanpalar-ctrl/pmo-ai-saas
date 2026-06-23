import { AnalysisService } from '../../services/AnalysisService';
import { AnalysisInputDTO } from '../../core/types';

jest.mock('../../services/multiAgentOrchestrator', () => ({
  orchestrator: {
    analyzeProject: jest.fn().mockResolvedValue({
      risk: {},
      economic: {},
      reports: { senior_report: 'Test', technical_report: 'Test' },
      metrics: { pv: 1000, ev: 800, ac: 900, cv: -100, cpi: 0.89, spi: 0.8, roi: -11 },
      timestamp: new Date().toISOString()
    })
  }
}));

jest.mock('../../db', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] })
  }
}));

jest.mock('../../core/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('[UNIT] AnalysisService', () => {
  let service: AnalysisService;

  beforeEach(() => {
    service = new AnalysisService();
  });

  describe('executeAnalysis', () => {
    it('debe ejecutar analisis con input valido', async () => {
      const input: AnalysisInputDTO = {
        projectId: 1,
        projectName: 'Test Project',
        framework: 'scrum'
      };
      const result = await service.executeAnalysis(input);
      expect(result).toBeDefined();
      expect(result.reports).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('debe respetar forceRefresh', async () => {
      const input: AnalysisInputDTO = {
        projectId: 1,
        projectName: 'Test',
        forceRefresh: true
      };
      const result = await service.executeAnalysis(input);
      expect(result).toBeDefined();
    });
  });
});
