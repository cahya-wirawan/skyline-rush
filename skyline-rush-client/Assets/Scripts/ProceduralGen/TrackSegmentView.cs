using System.Collections.Generic;
using UnityEngine;
using SkylineRush.Run;

namespace SkylineRush.ProceduralGen
{
    public class TrackSegmentView : MonoBehaviour
    {
        [Header("Anchors")]
        [SerializeField] private Transform entryAnchor;
        [SerializeField] private Transform exitAnchor;

        [Header("Containers")]
        [SerializeField] private Transform obstacleContainer;
        [SerializeField] private Transform chipContainer;

        public TrackSegment SegmentData { get; private set; }

        public void BindSegment(TrackSegment segmentData)
        {
            SegmentData = segmentData;
            ClearSpawnedChildren();
        }

        public void ClearSpawnedChildren()
        {
            if (obstacleContainer != null)
            {
                foreach (Transform child in obstacleContainer)
                {
                    Destroy(child.gameObject);
                }
            }
            if (chipContainer != null)
            {
                foreach (Transform child in chipContainer)
                {
                    Destroy(child.gameObject);
                }
            }
        }

        public Vector3 GetExitPosition()
        {
            return exitAnchor != null ? exitAnchor.position : transform.position + Vector3.forward * (SegmentData != null ? SegmentData.LengthMeters : 30f);
        }
    }
}
