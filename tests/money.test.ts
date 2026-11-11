import { describe, expect, it } from 'vitest';
import { currencyDigits, formatMoney, parseMoney, toMajorInput } from '@/utils/money';

// Intl sépare les milliers par une espace fine insécable : on la normalise pour comparer.
const plain = (value: string) => value.replace(/[  ]/g, ' ');

describe('CA-001-11 — montants selon la devise', () => {
  it('connaît les décimales de chaque devise', () => {
    expect(currencyDigits('XOF')).toBe(0);
    expect(currencyDigits('EUR')).toBe(2);
    expect(currencyDigits('TND')).toBe(3);
  });

  it('formate un montant mineur', () => {
    expect(plain(formatMoney(1500, 'XOF'))).toBe('1 500 F CFA');
    expect(plain(formatMoney(850, 'EUR'))).toBe('8,50 €');
    expect(plain(formatMoney(0, 'EUR'))).toBe('0,00 €');
  });

  it('lit un prix saisi et le convertit en entier mineur', () => {
    expect(parseMoney('1 500', 'XOF')).toBe(1500);
    expect(parseMoney('8,50', 'EUR')).toBe(850);
    expect(parseMoney('8.5', 'EUR')).toBe(850);
    expect(parseMoney('12', 'EUR')).toBe(1200);
    expect(parseMoney('0', 'XOF')).toBe(0);
  });

  it('refuse une saisie invalide pour la devise', () => {
    expect(parseMoney('1500,5', 'XOF')).toBeNull();
    expect(parseMoney('8,505', 'EUR')).toBeNull();
    expect(parseMoney('-3', 'EUR')).toBeNull();
    expect(parseMoney('abc', 'EUR')).toBeNull();
    expect(parseMoney('', 'XOF')).toBeNull();
    expect(parseMoney('200000000', 'XOF')).toBeNull();
  });

  it('prépare la valeur d’un champ de saisie', () => {
    expect(toMajorInput(850, 'EUR')).toBe('8,50');
    expect(toMajorInput(1500, 'XOF')).toBe('1500');
  });
});
