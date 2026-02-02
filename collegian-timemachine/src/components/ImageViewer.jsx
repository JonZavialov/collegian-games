import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import OpenSeadragon from "openseadragon";

/**
 * OpenSeadragon-based image viewer component for displaying newspaper pages.
 * Uses IIIF Image API for efficient tiled image loading.
 */
const ImageViewer = forwardRef(function ImageViewer(
  {
    iiifInfoUrl,
    redactionBoxes = [],
    imageDimensions = null,
    onImageLoad,
    onImageError,
  },
  ref
) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const overlayElementsRef = useRef([]);
  const isReadyRef = useRef(false);

  // Expose control methods via ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const viewer = viewerRef.current;
      if (viewer && isReadyRef.current) {
        viewer.viewport.zoomBy(1.5);
      }
    },
    zoomOut: () => {
      const viewer = viewerRef.current;
      if (viewer && isReadyRef.current) {
        viewer.viewport.zoomBy(0.67);
      }
    },
    resetZoom: () => {
      const viewer = viewerRef.current;
      if (viewer && isReadyRef.current) {
        viewer.viewport.goHome(true);
      }
    },
  }));

  // Initialize OpenSeadragon viewer
  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = OpenSeadragon({
      element: containerRef.current,
      prefixUrl: "",
      showNavigationControl: false,
      showZoomControl: false,
      showHomeControl: false,
      showFullPageControl: false,
      showRotationControl: false,
      minZoomLevel: 0.5,
      maxZoomLevel: 5,
      visibilityRatio: 0.5,
      constrainDuringPan: true,
      animationTime: 0.3,
      springStiffness: 10,
      crossOriginPolicy: "Anonymous",
      gestureSettingsTouch: {
        pinchRotate: false,
        flickEnabled: true,
        flickMinSpeed: 120,
        flickMomentum: 0.25,
      },
      gestureSettingsMouse: {
        clickToZoom: false,
        dblClickToZoom: true,
        scrollToZoom: true,
      },
    });

    viewerRef.current = viewer;

    return () => {
      isReadyRef.current = false;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Load IIIF image when URL changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !iiifInfoUrl) return;

    isReadyRef.current = false;

    // Clear existing overlays
    overlayElementsRef.current.forEach((el) => {
      try {
        viewer.removeOverlay(el);
      } catch {
        // Overlay may already be removed
      }
      el.remove();
    });
    overlayElementsRef.current = [];

    // Open IIIF image
    viewer.open(iiifInfoUrl);

    const handleOpen = () => {
      isReadyRef.current = true;
      if (onImageLoad) {
        const tiledImage = viewer.world.getItemAt(0);
        if (tiledImage) {
          const size = tiledImage.getContentSize();
          onImageLoad({
            width: size.x,
            height: size.y,
          });
        }
      }
    };

    const handleOpenFailed = (event) => {
      isReadyRef.current = false;
      console.error("OpenSeadragon failed to open image:", event);
      if (onImageError) {
        onImageError(event);
      }
    };

    viewer.addOnceHandler("open", handleOpen);
    viewer.addOnceHandler("open-failed", handleOpenFailed);

    return () => {
      viewer.removeHandler("open", handleOpen);
      viewer.removeHandler("open-failed", handleOpenFailed);
    };
  }, [iiifInfoUrl, onImageLoad, onImageError]);

  // Add redaction overlays when boxes or dimensions change
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !imageDimensions || redactionBoxes.length === 0) return;
    if (!isReadyRef.current) return;

    // Wait for image to be loaded
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;

    // Clear existing overlays
    overlayElementsRef.current.forEach((el) => {
      try {
        viewer.removeOverlay(el);
      } catch {
        // Overlay may already be removed
      }
      el.remove();
    });
    overlayElementsRef.current = [];

    // Add new overlays
    redactionBoxes.forEach((box, index) => {
      const overlay = document.createElement("div");
      overlay.id = `redaction-${index}`;
      overlay.style.backgroundColor = "#1a1a1a";
      overlay.style.borderRadius = "2px";
      overlay.style.pointerEvents = "none";

      // OpenSeadragon viewport coordinates: width is normalized to 1.0
      // Both x and y coordinates are relative to image width
      const rect = new OpenSeadragon.Rect(
        box.x / imageDimensions.width,
        box.y / imageDimensions.width,
        box.w / imageDimensions.width,
        box.h / imageDimensions.width
      );

      viewer.addOverlay({
        element: overlay,
        location: rect,
      });

      overlayElementsRef.current.push(overlay);
    });
  }, [redactionBoxes, imageDimensions]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ background: "#f1f5f9" }}
    />
  );
});

export default ImageViewer;
