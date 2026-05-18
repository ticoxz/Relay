import { Logger } from '../src/core/logger';

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
  let consoleWarnSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('success', () => {
    it('should log success message', () => {
      Logger.success('Test message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      Logger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      Logger.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('should log info message', () => {
      Logger.info('Info message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('step', () => {
    it('should log step with number', () => {
      Logger.step(1, 5, 'Step message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('divider', () => {
    it('should log divider line', () => {
      Logger.divider();
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('logIfNotQuiet', () => {
    it('should log when not quiet', () => {
      Logger.logIfNotQuiet('test', false);
      expect(consoleLogSpy).toHaveBeenCalledWith('test');
    });

    it('should not log when quiet', () => {
      Logger.logIfNotQuiet('test', true);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
});