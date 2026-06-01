import { describe, it, expect } from 'vitest';

import { UI_KIT_PACKAGE_VERSION } from './index';

describe('@sprint/ui-kit — smoke', () => {
  it('exporta a constante de versão do package', () => {
    expect(UI_KIT_PACKAGE_VERSION).toBe('0.0.0');
  });
});
