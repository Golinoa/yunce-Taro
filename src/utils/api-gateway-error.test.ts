import { describe, expect, it } from 'vitest';
import { mapGatewayErrorMessage, mapNetworkFailMessage } from '@/utils/api-gateway-error';

describe('api-gateway-error', () => {
  it('maps Cloudflare / gateway codes', () => {
    expect(mapGatewayErrorMessage(530)).toMatch(/cloudflared/i);
    expect(mapGatewayErrorMessage(503)).toMatch(/503/);
    expect(mapGatewayErrorMessage(404)).toBeNull();
  });

  it('maps network fail hints', () => {
    expect(mapNetworkFailMessage(new Error('request:fail timeout'))).toMatch(/超时/);
  });
});
