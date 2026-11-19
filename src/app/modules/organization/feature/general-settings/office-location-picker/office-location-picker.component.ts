import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import * as L from 'leaflet';
import { LeafletStylesComponent } from './leaflet-styles.component';

export interface OfficeLocationChange {
  address: string;
  latitude: number;
  longitude: number;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

const DEFAULT_CENTER: L.LatLngTuple = [20, 0];
const DEFAULT_ZOOM = 2;
const SELECTED_ZOOM = 17;
const SEARCH_DEBOUNCE_MS = 500;

/**
 * Address-to-coordinates picker for a legal entity's office location (Phase B on-site
 * work-location warning). Uses Leaflet + OpenStreetMap tiles and the free Nominatim
 * geocoding API - no API key, no billing dependency. Nominatim's usage policy asks for
 * light, non-bulk usage (this widget is only used from a settings screen edited
 * occasionally) - see https://operations.osmfoundation.org/policies/nominatim/.
 */
@Component({
  selector: 'app-office-location-picker',
  standalone: true,
  imports: [LeafletStylesComponent],
  templateUrl: './office-location-picker.component.html',
  styleUrl: './office-location-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfficeLocationPickerComponent implements AfterViewInit, OnDestroy {
  readonly address = input<string>('');
  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  readonly disabled = input<boolean>(false);

  readonly locationChange = output<OfficeLocationChange>();
  readonly locationCleared = output<void>();

  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  readonly searchQuery = signal('');
  readonly searchResults = signal<NominatimResult[]>([]);
  readonly searching = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly showResults = signal(false);

  private map: L.Map | undefined;
  private marker: L.Marker | undefined;
  private searchDebounceHandle: ReturnType<typeof setTimeout> | undefined;
  private searchAbortController: AbortController | undefined;
  private resizeObserver: ResizeObserver | undefined;

  constructor() {
    // Keep the marker/map/search box in sync if the parent form resets, loads a different
    // company's saved location, or the settings GET simply resolves after this view has
    // already initialized (the common case - lat/lng are null on first render). Re-running
    // this after our own emitted changes is harmless: the parent patches the same values
    // straight back down, so placeMarker/searchQuery just re-apply what's already there.
    effect(() => {
      const lat = this.latitude();
      const lon = this.longitude();
      const addr = this.address();
      if (!this.map) {
        return;
      }
      if (lat != null && lon != null) {
        const hadNoMarkerYet = !this.marker;
        this.placeMarker(lat, lon, { flyTo: false });
        if (hadNoMarkerYet) {
          this.map.setView([lat, lon], SELECTED_ZOOM);
        }
        this.map.invalidateSize();
      } else {
        this.clearMarker();
      }
      this.searchQuery.set(addr);
    });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.mapContainer().nativeElement, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    const lat = this.latitude();
    const lon = this.longitude();
    if (lat != null && lon != null) {
      this.placeMarker(lat, lon, { flyTo: false });
      this.map.setView([lat, lon], SELECTED_ZOOM);
      this.searchQuery.set(this.address());
    }

    setTimeout(() => this.map?.invalidateSize(), 0);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.map?.invalidateSize();
      });
      this.resizeObserver.observe(this.mapContainer().nativeElement);
    }

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      if (this.disabled()) {
        return;
      }
      this.selectPoint(event.latlng.lat, event.latlng.lng);
    });
  }

  ngOnDestroy(): void {
    this.searchAbortController?.abort();
    clearTimeout(this.searchDebounceHandle);
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    clearTimeout(this.searchDebounceHandle);
    this.searchError.set(null);

    if (value.trim().length < 3) {
      this.searchResults.set([]);
      this.showResults.set(false);
      return;
    }

    this.searchDebounceHandle = setTimeout(() => void this.runSearch(value.trim()), SEARCH_DEBOUNCE_MS);
  }

  selectResult(result: NominatimResult): void {
    const lat = Number(result.lat);
    const lon = Number(result.lon);
    this.placeMarker(lat, lon, { flyTo: true });
    this.map?.setView([lat, lon], SELECTED_ZOOM);
    this.searchQuery.set(result.display_name);
    this.showResults.set(false);
    this.searchResults.set([]);
    this.locationChange.emit({ address: result.display_name, latitude: lat, longitude: lon });
  }

  clearLocation(): void {
    this.clearMarker();
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.showResults.set(false);
    this.locationCleared.emit();
  }

  private async runSearch(query: string): Promise<void> {
    this.searchAbortController?.abort();
    const controller = new AbortController();
    this.searchAbortController = controller;

    this.searching.set(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`Search failed (${response.status})`);
      }
      const results = (await response.json()) as NominatimResult[];
      this.searchResults.set(results);
      this.showResults.set(true);
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        return;
      }
      this.searchError.set('Could not search for that address. Try again.');
      this.searchResults.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  private async reverseGeocode(lat: number, lon: number): Promise<void> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      const result = (await response.json()) as { display_name?: string };
      const address = result.display_name ?? `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      this.searchQuery.set(address);
      this.locationChange.emit({ address, latitude: lat, longitude: lon });
    } catch {
      // Reverse geocoding is a display-label convenience only - the coordinates themselves
      // (already emitted by selectPoint before this runs) are what actually get saved.
      const fallbackAddress = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      this.searchQuery.set(fallbackAddress);
      this.locationChange.emit({ address: fallbackAddress, latitude: lat, longitude: lon });
    }
  }

  private selectPoint(lat: number, lon: number): void {
    this.placeMarker(lat, lon, { flyTo: false });
    void this.reverseGeocode(lat, lon);
  }

  private placeMarker(lat: number, lon: number, options: { flyTo: boolean }): void {
    if (!this.map) {
      return;
    }
    const icon = L.divIcon({
      className: 'office-location-marker',
      html: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 7 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8z" fill="#2563eb" stroke="#1e3a8a" stroke-width="1.5"/>
        <circle cx="12" cy="10" r="3" fill="white"/>
      </svg>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    if (this.marker) {
      this.marker.setLatLng([lat, lon]);
    } else {
      this.marker = L.marker([lat, lon], { icon, draggable: !this.disabled() }).addTo(this.map);
      this.marker.on('dragend', () => {
        const position = this.marker!.getLatLng();
        void this.reverseGeocode(position.lat, position.lng);
      });
    }

    if (options.flyTo) {
      this.map.flyTo([lat, lon], SELECTED_ZOOM);
    }
  }

  private clearMarker(): void {
    if (this.marker) {
      this.marker.remove();
      this.marker = undefined;
    }
  }
}
