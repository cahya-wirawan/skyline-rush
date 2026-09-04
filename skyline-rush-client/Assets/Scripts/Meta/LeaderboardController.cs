using System;
using System.Threading.Tasks;
using SkylineRush.Networking;

namespace SkylineRush.Meta
{
    /// <summary>
    /// Pure C# state/logic class mirroring the web client's Leaderboard flow (web/game.js:
    /// openLeaderboard). Not a MonoBehaviour — a future thin Canvas view calls into this and reads
    /// its state.
    /// </summary>
    public class LeaderboardController
    {
        private readonly SkylineRushApiService _api;

        public bool IsVisible { get; private set; } = false;
        public bool IsLoading { get; private set; } = false;
        public string ErrorMessage { get; private set; } = null;

        public LeaderboardItemDto[] Items { get; private set; } = Array.Empty<LeaderboardItemDto>();
        public SelfRankDto SelfRank { get; private set; } = null;
        public bool EmptyFriendsPrompt { get; private set; } = false;

        public event Action OnLeaderboardRefreshed;
        public event Action<string> OnLoadFailed;

        public LeaderboardController(SkylineRushApiService api)
        {
            _api = api;
        }

        /// <summary>Mirrors game.js's openLeaderboard(), which always queries the neo-marina district global scope, limit 15.</summary>
        public async Task OpenAsync(string districtId = "neo-marina", string scope = "global", int limit = 15)
        {
            IsVisible = true;
            await RefreshAsync(districtId, scope, limit);
        }

        public void Close()
        {
            IsVisible = false;
        }

        public async Task RefreshAsync(string districtId = "neo-marina", string scope = "global", int limit = 15)
        {
            IsLoading = true;
            ErrorMessage = null;
            try
            {
                var data = await _api.GetLeaderboardAsync(districtId, limit, scope);
                Items = data.items ?? Array.Empty<LeaderboardItemDto>();
                SelfRank = data.self_rank;
                EmptyFriendsPrompt = data.empty_friends_prompt;
                OnLeaderboardRefreshed?.Invoke();
            }
            catch (ApiRequestException e)
            {
                ErrorMessage = "Could not reach leaderboard service.";
                OnLoadFailed?.Invoke(e.Message);
            }
            finally
            {
                IsLoading = false;
            }
        }

        /// <summary>Whether the given player_id is the local player, for view-side "YOU" chip highlighting (mirrors game.js's `item.player_id === Api.playerId` check).</summary>
        public static bool IsSelf(LeaderboardItemDto item, string localPlayerId)
        {
            return item != null && !string.IsNullOrEmpty(localPlayerId) && item.player_id == localPlayerId;
        }
    }
}
