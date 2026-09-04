using System;
using System.Threading.Tasks;
using SkylineRush.Networking;

namespace SkylineRush.Meta
{
    /// <summary>
    /// Pure C# state/logic class mirroring the web client's Parental Gate PIN-pad flow
    /// (web/game.js: openParentalGate, closeParentalGate, submitParentalGate; web/index.html's
    /// `.pin-key[data-digit]` keypad). Not a MonoBehaviour — a future thin Canvas view calls into
    /// this and reads its state/events.
    ///
    /// SECURITY-CRITICAL (CLAUDE.md #2): this class never computes, stores, or validates the
    /// expected arithmetic answer itself. It only:
    ///   1. Relays the server-issued challenge question/token from
    ///      SkylineRushApiService.RequestParentalGateChallengeAsync (GET /v1/auth/parental-gate/challenge).
    ///   2. Accumulates the digits the player taps on the keypad, exactly as typed.
    ///   3. Forwards the typed integer to SkylineRushApiService.VerifyParentalGateAsync
    ///      (POST /v1/auth/parental-gate/verify) and reports whatever the server decides.
    /// The only client-side validation performed is a format check (is the typed input a parsable
    /// integer at all?) — never a correctness check against an expected value, matching game.js's
    /// `isNaN(answer)` guard exactly.
    /// </summary>
    public class ParentalGateController
    {
        private readonly SkylineRushApiService _api;

        public bool IsVisible { get; private set; } = false;
        public bool IsBusy { get; private set; } = false;
        public string ChallengeQuestion { get; private set; } = null;
        public string ChallengeToken { get; private set; } = null;
        public string InputDigits { get; private set; } = "";
        public string ErrorMessage { get; private set; } = null;

        /// <summary>Server-issued 5-minute gate token from the most recent successful verification.</summary>
        public string LastVerifiedGateToken { get; private set; } = null;

        /// <summary>Max PIN length, matching web/game.js's `this.parentalInput.length < 5` guard.</summary>
        public const int MaxInputLength = 5;

        /// <summary>Fired once the server accepts the answer, carrying the parental_gate_token to pass on to the gated action (purchase / GDPR export / GDPR delete).</summary>
        public event Action<string> OnVerified;

        /// <summary>Fired when the server rejects the answer (HTTP 403) or the challenge could not be fetched.</summary>
        public event Action<string> OnFailed;

        public ParentalGateController(SkylineRushApiService api)
        {
            _api = api;
        }

        /// <summary>Mirrors game.js's openParentalGate(onSuccess): shows the modal and immediately requests a fresh challenge from the server.</summary>
        public async Task OpenAsync()
        {
            IsVisible = true;
            InputDigits = "";
            ErrorMessage = null;
            ChallengeQuestion = null;
            ChallengeToken = null;

            try
            {
                var challenge = await _api.RequestParentalGateChallengeAsync();
                ChallengeQuestion = challenge.question;
                ChallengeToken = challenge.challenge_token;
            }
            catch (ApiRequestException)
            {
                ChallengeQuestion = "Parental gate server unavailable";
                ChallengeToken = null;
            }
        }

        public void Close()
        {
            IsVisible = false;
            InputDigits = "";
        }

        /// <summary>Appends one keypad digit tap, matching web's per-key onclick handler.</summary>
        public void AppendDigit(char digit)
        {
            if (!char.IsDigit(digit)) return;
            if (InputDigits.Length >= MaxInputLength) return;
            InputDigits += digit;
        }

        /// <summary>Mirrors web's "CLEAR" pin-pad button.</summary>
        public void ClearInput()
        {
            InputDigits = "";
        }

        /// <summary>
        /// Mirrors game.js's submitParentalGate(). Performs only a format check locally (can the
        /// typed digits parse as an integer?) then relays them to the server, which is the sole
        /// authority on correctness.
        /// </summary>
        public async Task<bool> SubmitAsync()
        {
            ErrorMessage = null;

            if (!int.TryParse(InputDigits, out int answer))
            {
                ErrorMessage = "Please enter an answer using the keypad.";
                return false;
            }

            if (string.IsNullOrEmpty(ChallengeToken))
            {
                ErrorMessage = "Parental gate server unavailable";
                return false;
            }

            IsBusy = true;
            try
            {
                var result = await _api.VerifyParentalGateAsync(ChallengeToken, answer);
                LastVerifiedGateToken = result.parental_gate_token;
                IsVisible = false;
                OnVerified?.Invoke(LastVerifiedGateToken);
                return true;
            }
            catch (ApiRequestException)
            {
                // The server — not this class — determined the answer was incorrect (HTTP 403)
                // or some other verification failure occurred.
                ErrorMessage = "Incorrect answer. Please solve the challenge to proceed.";
                InputDigits = "";
                OnFailed?.Invoke(ErrorMessage);
                return false;
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
}
