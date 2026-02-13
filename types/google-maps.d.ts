declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (
          element: HTMLElement,
          options: {
            center: { lat: number; lng: number };
            zoom: number;
            mapId?: string;
            styles?: Array<{
              featureType?: string;
              elementType?: string;
              stylers?: Array<{ visibility?: string }>;
            }>;
          }
        ) => GoogleMap;
        Marker: new (options: {
          position: { lat: number; lng: number };
          map: GoogleMap;
          title?: string;
          label?: {
            text: string;
            color?: string;
            fontWeight?: string;
          };
        }) => GoogleMarker;
        InfoWindow: new (options: { content: string }) => GoogleInfoWindow;
        marker?: {
          AdvancedMarkerElement: new (options: {
            position: { lat: number; lng: number };
            map: GoogleMap;
            title?: string;
          }) => GoogleAdvancedMarker;
        };
      };
    };
  }

  interface GoogleMap {
    setCenter: (center: { lat: number; lng: number }) => void;
    setZoom: (zoom: number) => void;
  }

  interface GoogleMarker {
    addListener: (event: string, callback: () => void) => void;
    setMap: (map: GoogleMap | null) => void;
  }

  interface GoogleInfoWindow {
    open: (map: GoogleMap, marker: GoogleMarker) => void;
    close: () => void;
  }

  interface GoogleAdvancedMarker {
    position: { lat: number; lng: number };
    map: GoogleMap | null;
  }
}

export {};
