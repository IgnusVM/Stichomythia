import { summarizeForMemory, compressMemory } from './analysis.js';

interface MemoryBlock {
  coversSegments: [number, number];
  coversTurns: [number, number];
  summary: string;
  keyTopics: string[];
  emotionalHighlights: string[];
  runningJokes: string[];
  tier: 'recent' | 'mid' | 'old';
  createdAt: string;
}

interface Segment {
  sequenceNumber: number;
  turns: Array<{ sequenceNumber: number; text: string }>;
  rawResponse: string;
}

const TIER_WORD_COUNTS = {
  recent: 200,
  mid: 80,
  old: 30,
};

export async function createMemoryBlock(
  segments: Segment[],
  startSegIdx: number,
  endSegIdx: number,
): Promise<MemoryBlock> {
  const targetSegments = segments.slice(startSegIdx, endSegIdx + 1);
  const dialogues = targetSegments.map(s => s.rawResponse);

  const firstTurn = targetSegments[0]?.turns[0]?.sequenceNumber ?? 0;
  const lastSeg = targetSegments[targetSegments.length - 1];
  const lastTurn = lastSeg?.turns[lastSeg.turns.length - 1]?.sequenceNumber ?? 0;

  const result = await summarizeForMemory(dialogues, TIER_WORD_COUNTS.recent);

  return {
    coversSegments: [startSegIdx, endSegIdx],
    coversTurns: [firstTurn, lastTurn],
    summary: result.summary,
    keyTopics: result.keyTopics,
    emotionalHighlights: result.emotionalHighlights,
    runningJokes: result.runningJokes,
    tier: 'recent',
    createdAt: new Date().toISOString(),
  };
}

export async function retiereMemories(memories: MemoryBlock[]): Promise<MemoryBlock[]> {
  if (memories.length <= 3) return memories;

  const updated = [...memories];

  for (let i = 0; i < updated.length; i++) {
    const blocksFromEnd = updated.length - i;
    let targetTier: MemoryBlock['tier'];

    if (blocksFromEnd <= 3) {
      targetTier = 'recent';
    } else if (blocksFromEnd <= 8) {
      targetTier = 'mid';
    } else {
      targetTier = 'old';
    }

    if (updated[i].tier !== targetTier) {
      const targetWords = TIER_WORD_COUNTS[targetTier];
      const compressed = await compressMemory(updated[i].summary, targetWords);
      updated[i] = {
        ...updated[i],
        summary: compressed,
        tier: targetTier,
      };
    }
  }

  return updated;
}

export async function processMemoryAfterSegment(
  segments: Segment[],
  existingMemories: MemoryBlock[],
  memorySummaryInterval: number,
): Promise<MemoryBlock[] | null> {
  const segmentCount = segments.length;

  const lastMemoryEnd = existingMemories.length > 0
    ? existingMemories[existingMemories.length - 1].coversSegments[1]
    : -1;

  const uncoveredSegments = segmentCount - 1 - lastMemoryEnd;
  if (uncoveredSegments < memorySummaryInterval) {
    return null;
  }

  const allMemories = [...existingMemories];
  let cursor = lastMemoryEnd + 1;

  while (cursor + memorySummaryInterval - 1 < segmentCount) {
    const blockEnd = cursor + memorySummaryInterval - 1;
    const newBlock = await createMemoryBlock(segments, cursor, blockEnd);
    allMemories.push(newBlock);
    cursor = blockEnd + 1;
  }

  if (allMemories.length === existingMemories.length) {
    return null;
  }

  return retiereMemories(allMemories);
}
