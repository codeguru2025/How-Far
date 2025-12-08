export function generateQRMatrix(text: string, size: number = 21): boolean[][] {
  const matrix: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));
  
  const hash = simpleHash(text);
  
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      matrix[i][j] = (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
      matrix[i][size - 1 - j] = matrix[i][j];
      matrix[size - 1 - i][j] = matrix[i][j];
    }
  }
  
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }
  
  let dataIndex = 0;
  for (let i = 8; i < size - 1; i++) {
    for (let j = 8; j < size - 1; j++) {
      const bit = (hash >> (dataIndex % 32)) & 1;
      matrix[i][j] = bit === 1;
      dataIndex++;
    }
  }
  
  return matrix;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function generateQRToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
