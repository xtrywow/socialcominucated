import type {Layout} from '../theme';

export type Token = {word: string; gold: boolean} | {br: true};

// '**x**' = طلایی، '|' = شکست خط در نسخهٔ عمودی (در افقی فاصله)
export const tokenize = (text: string, layout: Layout): Token[] => {
  const tokens: Token[] = [];
  let gold = false;
  let current = '';
  let currentGold = false;
  const flush = () => {
    if (current) tokens.push({word: current, gold: currentGold});
    current = '';
  };
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('**', i)) {
      gold = !gold;
      i++;
      continue;
    }
    const ch = text[i];
    if (ch === ' ' || ch === '|') {
      flush();
      if (ch === '|' && layout === 'portrait') tokens.push({br: true});
      continue;
    }
    if (!current) currentGold = gold;
    current += ch;
  }
  flush();
  return tokens;
};

export const plain = (text: string) => text.replace(/\*\*/g, '').replace(/\|/g, ' ');
export const hasLatin = (s: string) => /[A-Za-z]/.test(s);
