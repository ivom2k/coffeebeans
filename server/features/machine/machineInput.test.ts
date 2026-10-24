import { describe, expect, it } from 'vitest';
import { addMachineSchema, updateMachineSchema } from './machineInput.ts';

describe('machine input', () => {
  it('Should_StoreNoNickname_When_NicknameIsBlankOrLeftOut', () => {
    // Act
    const blank = updateMachineSchema.parse({ nickname: '   ' });
    const leftOut = addMachineSchema.parse({ machineModelId: 3 });

    // Assert
    expect(blank).toEqual({ nickname: null });
    expect(leftOut).toEqual({ machineModelId: 3, nickname: null });
  });

  it('Should_TrimTheNickname_When_ItHasSurroundingSpaces', () => {
    // Act
    const input = updateMachineSchema.parse({ nickname: '  Kodu ' });

    // Assert
    expect(input).toEqual({ nickname: 'Kodu' });
  });

  it('Should_Reject_When_NicknameIsLongerThanTheColumn', () => {
    // Act
    const result = updateMachineSchema.safeParse({ nickname: 'x'.repeat(51) });

    // Assert
    expect(result.success).toBe(false);
  });

  it('Should_Reject_When_ModelIdIsNotAPositiveInteger', () => {
    // Act
    const results = [0, 1.5, '3'].map(machineModelId => addMachineSchema.safeParse({ machineModelId }));

    // Assert
    expect(results.map(result => result.success)).toEqual([false, false, false]);
  });
});
