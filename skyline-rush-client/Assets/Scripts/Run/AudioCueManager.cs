using UnityEngine;

namespace SkylineRush.Run
{
    public class AudioCueManager : MonoBehaviour
    {
        public static AudioCueManager Instance { get; private set; }

        [Header("Audio Clips")]
        [SerializeField] private AudioClip swipeClip;
        [SerializeField] private AudioClip jumpClip;
        [SerializeField] private AudioClip slideClip;
        [SerializeField] private AudioClip chipPickupClip;
        [SerializeField] private AudioClip shieldBreakClip;
        [SerializeField] private AudioClip crashClip;
        [SerializeField] private AudioClip redeployClip;

        [Header("Audio Sources")]
        [SerializeField] private AudioSource sfxSource;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
            }
        }

        public void PlaySwipe() => PlaySound(swipeClip);
        public void PlayJump() => PlaySound(jumpClip);
        public void PlaySlide() => PlaySound(slideClip);
        public void PlayChipPickup() => PlaySound(chipPickupClip, 0.7f);
        public void PlayShieldBreak() => PlaySound(shieldBreakClip);
        public void PlayCrash() => PlaySound(crashClip);
        public void PlayRedeploy() => PlaySound(redeployClip);

        private void PlaySound(AudioClip clip, float volume = 1.0f)
        {
            if (sfxSource != null && clip != null)
            {
                sfxSource.PlayOneShot(clip, volume);
            }
        }
    }
}
