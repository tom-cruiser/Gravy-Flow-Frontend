import { describe, expect, it } from 'vitest';
import { parseContainerPort } from '@/lib/portMap';
import {
  deploymentStatusBucket,
  deploymentStatusLabel,
  deploymentStatusVariant,
} from '@/lib/deploymentStatus';

describe('parseContainerPort', () => {
  it('uses the container side of host:container', () => {
    expect(parseContainerPort('8081:3000')).toBe(3000);
  });

  it('treats a bare port as both sides', () => {
    expect(parseContainerPort('5000')).toBe(5000);
  });

  it('falls back on missing or garbage input', () => {
    expect(parseContainerPort(undefined)).toBe(8080);
    expect(parseContainerPort('abc', 9000)).toBe(9000);
    expect(parseContainerPort('80:0')).toBe(8080);
  });
});

describe('deployment status', () => {
  it('maps statuses case-insensitively', () => {
    expect(deploymentStatusVariant('RUNNING')).toBe('success');
    expect(deploymentStatusVariant('failed')).toBe('destructive');
    expect(deploymentStatusVariant('weird')).toBe('default');
    expect(deploymentStatusBucket('Deploying')).toBe('inProgress');
    expect(deploymentStatusBucket('unknown')).toBe('notRunning');
    expect(deploymentStatusLabel('building')).toBe('Building');
  });
});
