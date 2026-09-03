import { IDatabase, getDatabase } from '@libs/db';

export class LeaderboardService {
  private db: IDatabase;

  constructor(db?: IDatabase) {
    this.db = db || getDatabase();
  }

  async getLeaderboard(
    playerId: string,
    scope: 'global' | 'friends' = 'global',
    districtId = 'neo-marina',
    limit = 25,
    cursor?: string
  ) {
    const allRuns = await this.db.getRunsByDistrict(districtId, 1000);

    // Compute best score per player
    const playerBestMap = new Map<string, { meters: number; playerId: string }>();
    for (const r of allRuns) {
      const existing = playerBestMap.get(r.player_id);
      if (!existing || r.meters > existing.meters) {
        playerBestMap.set(r.player_id, { meters: r.meters, playerId: r.player_id });
      }
    }

    let candidatePlayers = Array.from(playerBestMap.values());

    let emptyFriendsPrompt = false;

    if (scope === 'friends') {
      const friends = await this.db.getFriends(playerId);
      if (friends.length === 0) {
        emptyFriendsPrompt = true;
      }
      const allowedIds = new Set([playerId, ...friends]);
      candidatePlayers = candidatePlayers.filter(p => allowedIds.has(p.playerId));
    }

    // Sort descending by meters
    candidatePlayers.sort((a, b) => b.meters - a.meters);

    // CRIT-15: Batch player lookups in parallel
    const playerIds = candidatePlayers.map(p => p.playerId);
    const playerRecords = await Promise.all(playerIds.map(id => this.db.getPlayerById(id)));
    const playerMap = new Map<string, any>();
    playerRecords.forEach((record, idx) => {
      if (record) playerMap.set(playerIds[idx], record);
    });

    // Build ranked list with display names
    const rankedItems = candidatePlayers.map((p, i) => {
      const playerRecord = playerMap.get(p.playerId);
      return {
        rank: i + 1,
        player_id: p.playerId,
        display_name: playerRecord ? playerRecord.display_name : `Runner#${p.playerId.substring(0, 4)}`,
        meters: p.meters
      };
    });

    // Calculate self_rank
    let selfRank: { rank: number; meters: number } | null = null;
    const selfItem = rankedItems.find(item => item.player_id === playerId);
    if (selfItem) {
      selfRank = { rank: selfItem.rank, meters: selfItem.meters };
    } else {
      const best = await this.db.getPlayerBestRun(playerId, districtId);
      if (best) {
        selfRank = { rank: rankedItems.length + 1, meters: best.meters };
      }
    }

    // Cursor pagination
    let startIndex = 0;
    if (cursor) {
      const idx = rankedItems.findIndex(item => item.player_id === cursor);
      if (idx !== -1) startIndex = idx + 1;
    }

    const items = rankedItems.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < rankedItems.length ? items[items.length - 1]?.player_id : null;

    return {
      items,
      self_rank: selfRank,
      next_cursor: nextCursor,
      empty_friends_prompt: emptyFriendsPrompt
    };
  }

  async addFriend(playerId: string, code: string): Promise<{ ok: boolean }> {
    // Look up player by friend code or prefix
    let targetPlayer = null;
    if (code.startsWith('SKY-')) {
      const suffix = code.replace('SKY-', '').toLowerCase();
      for (const p of (this.db as any).players?.values?.() || []) {
        if (p.player_id.toLowerCase().includes(suffix) && p.player_id !== playerId) {
          targetPlayer = p;
          break;
        }
      }
    } else {
      const p = await this.db.getPlayerById(code);
      if (p && p.player_id !== playerId) {
        targetPlayer = p;
      }
    }

    // CRIT-13: Removed fallback loop that added random strangers on typo! Throw NOT_FOUND immediately.
    if (!targetPlayer) {
      const err: any = new Error('Friend code not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    await this.db.addFriendLink(playerId, targetPlayer.player_id, 'friend_code');
    return { ok: true };
  }
}
