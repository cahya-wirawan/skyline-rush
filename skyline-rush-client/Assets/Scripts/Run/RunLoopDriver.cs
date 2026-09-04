using System;
using UnityEngine;

namespace SkylineRush.Run
{
    /// <summary>
    /// Orchestration layer that owns a <see cref="RunSession"/> instance, drives its per-frame
    /// Update() from Unity's MonoBehaviour lifecycle, and forwards the session's domain events
    /// outward so a future Scene-wiring pass can hook HUD/redeploy/summary UI to it without
    /// touching RunSession directly.
    ///
    /// Expected GameObject/Inspector wiring (once a Scene exists):
    /// - Attach this component to an empty GameObject named e.g. "RunLoopDriver" that lives for
    ///   the lifetime of the Run scene/state.
    /// - Assign <see cref="runnerView"/> to the RunnerView component on the Runner child GameObject.
    ///   This driver calls RunnerView.Initialize(Session) on Awake/Start so the view can subscribe
    ///   to OnRunCrashed/OnRunResumed itself for visual feedback.
    /// - Optionally assign a HUD controller MonoBehaviour reference (once one exists) that reads
    ///   from Session every frame or reacts to the events this driver forwards.
    /// - Call StartRun() once the Scene has finished loading obstacles/track segments to begin
    ///   the loop; this driver does not auto-start on Awake so callers can control sequencing
    ///   (e.g. waiting for ProceduralTrackGenerator to populate the first segments).
    /// </summary>
    public class RunLoopDriver : MonoBehaviour
    {
        [Header("View References")]
        [SerializeField] private RunnerView runnerView;

        /// <summary>The owned run session. Exposed read-only so external controllers (HUD, redeploy modal) can read live state each frame.</summary>
        public RunSession Session { get; private set; }

        public bool IsRunActive => Session != null && Session.State == RunState.Active;

        /// <summary>Forwarded from RunSession.OnRunCrashed. Payload is the crash cause string.</summary>
        public event Action<string> OnRunCrashed;

        /// <summary>Forwarded from RunSession.OnRunResumed (fires after a successful redeploy).</summary>
        public event Action OnRunResumed;

        /// <summary>Forwarded from RunSession.OnRunCompleted (fires when the player concludes/gives up the run).</summary>
        public event Action OnRunCompleted;

        private void Awake()
        {
            Session = new RunSession();
            Session.OnRunCrashed += HandleRunCrashed;
            Session.OnRunResumed += HandleRunResumed;
            Session.OnRunCompleted += HandleRunCompleted;

            if (runnerView != null)
            {
                runnerView.Initialize(Session);
            }
        }

        private void OnDestroy()
        {
            if (Session != null)
            {
                Session.OnRunCrashed -= HandleRunCrashed;
                Session.OnRunResumed -= HandleRunResumed;
                Session.OnRunCompleted -= HandleRunCompleted;
            }
        }

        private void Update()
        {
            if (Session == null) return;
            Session.Update(Time.deltaTime);
        }

        /// <summary>Begins/restarts the owned session. Safe to call repeatedly ("Play Again" flow).</summary>
        public void StartRun()
        {
            Session?.StartRun();
        }

        private void HandleRunCrashed(string cause) => OnRunCrashed?.Invoke(cause);
        private void HandleRunResumed() => OnRunResumed?.Invoke();
        private void HandleRunCompleted() => OnRunCompleted?.Invoke();
    }
}
