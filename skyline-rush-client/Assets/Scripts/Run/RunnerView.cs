using System;
using UnityEngine;

namespace SkylineRush.Run
{
    public class RunnerView : MonoBehaviour
    {
        [Header("Visual Transform References")]
        [SerializeField] private Transform characterModel;
        [SerializeField] private GameObject shieldBubble;
        [SerializeField] private ParticleSystem trailParticles;

        [Header("Smoothing")]
        [SerializeField] private float laneChangeSpeed = 15f;
        [SerializeField] private float verticalSpeed = 18f;

        private RunSession _session;
        private Vector3 _targetPosition;

        public void Initialize(RunSession session)
        {
            _session = session;
            if (_session != null)
            {
                _session.OnRunCrashed += HandleCrashed;
                _session.OnRunResumed += HandleResumed;
            }
            if (shieldBubble != null) shieldBubble.SetActive(false);
        }

        private void OnDestroy()
        {
            if (_session != null)
            {
                _session.OnRunCrashed -= HandleCrashed;
                _session.OnRunResumed -= HandleResumed;
            }
        }

        private void Update()
        {
            if (_session == null) return;

            // Interpolate continuous coordinates from physics models
            float currentX = _session.LaneMachine.CurrentXPosition;
            float currentY = _session.JumpSlide.CurrentYPosition;
            float currentZ = _session.DistanceMeters;

            _targetPosition = new Vector3(currentX, currentY, currentZ);
            transform.position = Vector3.Lerp(transform.position, _targetPosition, Time.deltaTime * laneChangeSpeed);

            // Update shield visual
            if (shieldBubble != null)
            {
                shieldBubble.SetActive(_session.PowerUps.IsShieldActive);
            }
        }

        private void HandleCrashed(string cause)
        {
            if (trailParticles != null) trailParticles.Stop();
        }

        private void HandleResumed()
        {
            if (trailParticles != null) trailParticles.Play();
        }
    }
}
