import { describe, expect, it } from 'vitest';

import {
  DirectoryNotFoundError,
  FileNotFoundError,
  FilesystemError,
  FilesystemIOError,
  NotImplementedError,
} from './errors';

describe('FilesystemError hierarchy', () => {
  describe('FileNotFoundError', () => {
    it('estende FilesystemError e Error', () => {
      const err = new FileNotFoundError('/x');
      expect(err).toBeInstanceOf(FilesystemError);
      expect(err).toBeInstanceOf(FileNotFoundError);
      expect(err).toBeInstanceOf(Error);
    });

    it('expõe name discriminante', () => {
      expect(new FileNotFoundError('/x').name).toBe('FileNotFoundError');
    });

    it('expõe filepath', () => {
      expect(new FileNotFoundError('/path/to/file.json').filepath).toBe('/path/to/file.json');
    });

    it('mensagem inclui filepath', () => {
      expect(new FileNotFoundError('/p/x.json').message).toContain('/p/x.json');
    });

    it('cause é undefined quando não passada', () => {
      expect(new FileNotFoundError('/x').cause).toBeUndefined();
    });

    it('cause é preservada quando passada', () => {
      const original = new Error('ENOENT');
      expect(new FileNotFoundError('/x', original).cause).toBe(original);
    });
  });

  describe('DirectoryNotFoundError', () => {
    it('estende FilesystemError e Error', () => {
      const err = new DirectoryNotFoundError('/x');
      expect(err).toBeInstanceOf(FilesystemError);
      expect(err).toBeInstanceOf(DirectoryNotFoundError);
      expect(err).toBeInstanceOf(Error);
    });

    it('expõe name discriminante', () => {
      expect(new DirectoryNotFoundError('/x').name).toBe('DirectoryNotFoundError');
    });

    it('mensagem inclui filepath', () => {
      expect(new DirectoryNotFoundError('/d/sub').message).toContain('/d/sub');
    });

    it('cause é preservada quando passada', () => {
      const original = new Error('ENOENT');
      expect(new DirectoryNotFoundError('/x', original).cause).toBe(original);
    });
  });

  describe('FilesystemIOError', () => {
    it('estende FilesystemError e Error', () => {
      const err = new FilesystemIOError('/x', 'permissão negada');
      expect(err).toBeInstanceOf(FilesystemError);
      expect(err).toBeInstanceOf(FilesystemIOError);
      expect(err).toBeInstanceOf(Error);
    });

    it('expõe name discriminante', () => {
      expect(new FilesystemIOError('/x', 'msg').name).toBe('FilesystemIOError');
    });

    it('mensagem combina filepath e detalhe específico', () => {
      const err = new FilesystemIOError('/x', 'sem espaço em disco');
      expect(err.message).toContain('/x');
      expect(err.message).toContain('sem espaço em disco');
    });

    it('cause é preservada quando passada', () => {
      const original = new Error('EACCES');
      const err = new FilesystemIOError('/x', 'falha', original);
      expect(err.cause).toBe(original);
    });
  });

  describe('FilesystemError abstract base', () => {
    it('não pode ser instanciada diretamente (runtime check)', () => {
      expect(() => {
        // @ts-expect-error - FilesystemError é abstract
        void new FilesystemError('/x', 'msg');
      }).toThrow(TypeError);
    });

    it('discriminação via instanceof permite tratamento genérico', () => {
      const errors: FilesystemError[] = [
        new FileNotFoundError('/a'),
        new DirectoryNotFoundError('/b'),
        new FilesystemIOError('/c', 'msg'),
        new NotImplementedError('writeCancel'),
      ];
      for (const err of errors) {
        expect(err).toBeInstanceOf(FilesystemError);
      }
    });
  });

  describe('NotImplementedError', () => {
    it('estende FilesystemError e Error', () => {
      const err = new NotImplementedError('writeCancel');
      expect(err).toBeInstanceOf(FilesystemError);
      expect(err).toBeInstanceOf(NotImplementedError);
      expect(err).toBeInstanceOf(Error);
    });

    it('expõe name discriminante', () => {
      expect(new NotImplementedError('foo').name).toBe('NotImplementedError');
    });

    it('expõe operationName', () => {
      expect(new NotImplementedError('writeCancel').operationName).toBe('writeCancel');
    });

    it('mensagem inclui operationName', () => {
      expect(new NotImplementedError('writeCancel').message).toContain('writeCancel');
    });

    it('filepath default é placeholder quando não passado', () => {
      expect(new NotImplementedError('foo').filepath).toBe('<not-applicable>');
    });

    it('filepath é preservado quando passado', () => {
      expect(new NotImplementedError('foo', '/p/x.json').filepath).toBe('/p/x.json');
    });

    it('cause é undefined (NotImplementedError não recebe cause)', () => {
      expect(new NotImplementedError('foo').cause).toBeUndefined();
    });
  });
});
