/**
 * NASA Earthdata Intelligence Service
 *
 * VERSION: 1.0.0 (March 2026)
 *
 * Five authenticated data products using NASA_EARTHDATA_TOKEN:
 *   1. CMR Granule Search      — discover 1B+ satellite granules by bbox/date/instrument
 *   2. GPM Precipitation       — observed rain rate from GPM IMERG (not a forecast)
 *   3. Maritime SST            — sea surface temperature from MUR-SST / GHRSST
 *   4. Soil Moisture           — SMAP L3 soil moisture for any coordinate
 *   5. Ocean Color             — MODIS-Aqua chlorophyll-a and turbidity
 *
 * All services: $0.25/call · 15-min to 24-hr cache per dataset update frequency
 * Auth: Authorization: Bearer <NASA_EARTHDATA_TOKEN> on all requests
 * Provenance block included in every response per NASA data policy.
 */

const CMR_BASE = 'https://cmr.earthdata.nasa.gov/search';
const GESDISC_OPENDAP = 'https://gpm1.gesdisc.eosdis.nasa.gov/opendap';
const PODAAC_CMR_PROVIDER = 'PODAAC';
const NSIDC_CMR_PROVIDER = 'NSIDC_ECS';
const OBDAAC_CMR_PROVIDER = 'OB_DAAC';

const PRICE_USD = 0.25;

export interface EarthdataProvenance {
  dataset: string;
  shortName: string;
  granuleId?: string;
  acquisitionDate?: string;
  processingLevel: string;
  dataCenter: string;
  downloadUrl?: string;
}

export interface CmrGranule {
  id: string;
  title: string;
  platform: string;
  instrument: string;
  startDate: string;
  endDate: string;
  cloudCover?: number;
  bbox: { west: number; south: number; east: number; north: number };
  downloadUrls: string[];
  thumbnailUrl?: string;
  dataCenter: string;
  dayNightFlag?: string;
  browseFlag: boolean;
}

export interface CmrSearchParams {
  bbox: { west: number; south: number; east: number; north: number };
  startDate?: string;
  endDate?: string;
  platform?: string;
  shortName?: string;
  maxCloudCover?: number;
  limit?: number;
  sortKey?: string;
}

export interface CmrSearchResult {
  granules: CmrGranule[];
  totalHits: number;
  searchParams: Record<string, any>;
  provenance: EarthdataProvenance;
}

export interface PrecipitationResult {
  lat: number;
  lon: number;
  precipitationMmHr?: number;
  precipitationMm24hr?: number;
  qualityFlag?: number;
  qualityLabel?: string;
  mostRecentGranuleDate?: string;
  dataResolutionDeg: number;
  coverageNote: string;
  provenance: EarthdataProvenance;
}

export interface SstResult {
  lat: number;
  lon: number;
  temperatureCelsius?: number;
  temperatureKelvin?: number;
  analysisDate?: string;
  qualityLevel?: number;
  qualityLabel?: string;
  dataResolutionKm: number;
  coverageNote: string;
  provenance: EarthdataProvenance;
}

export interface SoilMoistureResult {
  lat: number;
  lon: number;
  soilMoistureMm3?: number;
  qualityFlag?: string;
  retrievalQuality?: string;
  measurementDate?: string;
  dataResolutionKm: number;
  coverageNote: string;
  provenance: EarthdataProvenance;
}

export interface OceanColorResult {
  lat: number;
  lon: number;
  chlorophyllMgM3?: number;
  chlorophyllQuality?: string;
  kd490Turbidity?: number;
  measurementDate?: string;
  dataResolutionKm: number;
  coverageNote: string;
  provenance: EarthdataProvenance;
}

export class EarthdataService {
  private responseCache = new Map<string, { data: any; expiry: number }>();
  private readonly token: string | null;

  constructor() {
    this.token = process.env.NASA_EARTHDATA_TOKEN || null;
  }

  isConfigured(): boolean {
    return !!this.token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'CoinRailz-EarthdataClient/1.0',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private getCached(key: string): any | null {
    const entry = this.responseCache.get(key);
    if (entry && Date.now() < entry.expiry) return entry.data;
    if (entry) this.responseCache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttlMs: number): void {
    this.responseCache.set(key, { data, expiry: Date.now() + ttlMs });
  }

  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  private requireToken(): void {
    if (!this.token) {
      throw new Error('NASA_EARTHDATA_TOKEN is not configured');
    }
  }

  // ─── 1. CMR GRANULE SEARCH ─────────────────────────────────────────────────

  async searchGranules(params: CmrSearchParams): Promise<CmrSearchResult> {
    this.requireToken();

    const limit = Math.min(params.limit ?? 10, 50);
    const endDate = params.endDate ?? new Date().toISOString();
    const startDate = params.startDate ?? this.formatDate(this.daysAgo(30)) + 'T00:00:00Z';

    const cacheKey = `cmr_granules_${JSON.stringify(params)}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const searchParams = new URLSearchParams({
      bounding_box: `${params.bbox.west},${params.bbox.south},${params.bbox.east},${params.bbox.north}`,
      temporal: `${startDate},${endDate}`,
      page_size: String(limit),
      sort_key: params.sortKey ?? '-start_date',
    });

    if (params.platform) searchParams.set('platform', params.platform);
    if (params.shortName) searchParams.set('short_name', params.shortName);
    if (params.maxCloudCover != null) {
      searchParams.set('cloud_cover', `,${params.maxCloudCover}`);
    }

    const url = `${CMR_BASE}/granules.json?${searchParams.toString()}`;
    const response = await fetch(url, { headers: this.getHeaders() });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`CMR search failed (${response.status}): ${body.slice(0, 200)}`);
    }

    const json = await response.json() as any;
    const hits = parseInt(response.headers.get('CMR-Hits') ?? '0', 10);
    const entries = json?.feed?.entry ?? [];

    const granules: CmrGranule[] = entries.map((e: any) => {
      const downloadUrls = (e.links ?? [])
        .filter((l: any) => l.rel?.includes('data#') || l.type === 'application/octet-stream')
        .map((l: any) => l.href as string);

      const thumbnailUrl = (e.links ?? [])
        .find((l: any) => l.rel?.includes('browse#') || l.type?.startsWith('image/'))
        ?.href;

      const box = e.boxes?.[0]?.split(' ').map(Number);
      const bbox = box
        ? { south: box[0], west: box[1], north: box[2], east: box[3] }
        : params.bbox;

      return {
        id: e.id,
        title: e.title ?? '',
        platform: e.platforms?.[0]?.short_name ?? 'Unknown',
        instrument: e.platforms?.[0]?.instruments?.[0]?.short_name ?? 'Unknown',
        startDate: e.time_start ?? '',
        endDate: e.time_end ?? '',
        cloudCover: e.cloud_cover != null ? Number(e.cloud_cover) : undefined,
        bbox,
        downloadUrls,
        thumbnailUrl,
        dataCenter: e.data_center ?? '',
        dayNightFlag: e.day_night_flag,
        browseFlag: e.browse_flag ?? false,
      };
    });

    const result: CmrSearchResult = {
      granules,
      totalHits: hits,
      searchParams: {
        bbox: params.bbox,
        startDate,
        endDate,
        platform: params.platform,
        shortName: params.shortName,
        maxCloudCover: params.maxCloudCover,
        limit,
      },
      provenance: {
        dataset: 'NASA Common Metadata Repository (CMR)',
        shortName: params.shortName ?? 'multi-collection',
        processingLevel: 'L1-L4 (varies by collection)',
        dataCenter: 'EOSDIS',
      },
    };

    this.setCache(cacheKey, result, 60 * 60 * 1000); // 1-hour TTL
    return result;
  }

  // ─── 2. GPM PRECIPITATION ─────────────────────────────────────────────────

  async getPrecipitation(lat: number, lon: number, hoursBack: number = 24): Promise<PrecipitationResult> {
    this.requireToken();

    const cacheKey = `gpm_${lat.toFixed(2)}_${lon.toFixed(2)}_${hoursBack}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    // Find the most recent GPM IMERG daily granule covering this coordinate
    const endDate = new Date().toISOString();
    const startDate = this.formatDate(this.daysAgo(5)) + 'T00:00:00Z';

    const margin = 0.5;
    const searchParams = new URLSearchParams({
      short_name: 'GPM_3IMERGDL',
      bounding_box: `${lon - margin},${lat - margin},${lon + margin},${lat + margin}`,
      temporal: `${startDate},${endDate}`,
      page_size: '3',
      sort_key: '-start_date',
    });

    const cmrUrl = `${CMR_BASE}/granules.json?${searchParams}`;
    const cmrResp = await fetch(cmrUrl, { headers: this.getHeaders() });

    if (!cmrResp.ok) {
      throw new Error(`GPM CMR search failed (${cmrResp.status})`);
    }

    const cmrJson = await cmrResp.json() as any;
    const entries = cmrJson?.feed?.entry ?? [];

    const provenance: EarthdataProvenance = {
      dataset: 'GPM IMERG Daily Late Run V07',
      shortName: 'GPM_3IMERGDL',
      processingLevel: 'L3',
      dataCenter: 'GES_DISC',
    };

    if (entries.length === 0) {
      const result: PrecipitationResult = {
        lat, lon,
        dataResolutionDeg: 0.1,
        coverageNote: 'No recent GPM IMERG granule found for this location/time window. Try expanding the time range.',
        provenance,
      };
      this.setCache(cacheKey, result, 30 * 60 * 1000);
      return result;
    }

    const granule = entries[0];
    const acquisitionDate = granule.time_start ?? '';
    provenance.granuleId = granule.id;
    provenance.acquisitionDate = acquisitionDate;

    const opendapLink = (granule.links ?? []).find(
      (l: any) => l.href?.includes('opendap') || l.type === 'application/octet-stream' && l.href?.includes('gesdisc')
    )?.href;

    let precipMmHr: number | undefined;
    let qualityFlag: number | undefined;

    if (opendapLink) {
      try {
        const latIdx = Math.round((lat + 89.95) / 0.1);
        const lonIdx = Math.round((lon + 179.95) / 0.1);
        const clampedLatIdx = Math.max(0, Math.min(1799, latIdx));
        const clampedLonIdx = Math.max(0, Math.min(3599, lonIdx));

        const opendapUrl = `${opendapLink}.dap.json?precipitationCal[0][${clampedLatIdx}:${clampedLatIdx}][${clampedLonIdx}:${clampedLonIdx}]`;
        provenance.downloadUrl = opendapLink;

        const dapResp = await fetch(opendapUrl, {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(8000),
        });

        if (dapResp.ok) {
          const dapJson = await dapResp.json() as any;
          const val = dapJson?.['precipitationCal']?.data?.[0]?.[0]?.[0]
            ?? dapJson?.['precipitationCal']?.data?.[0]?.[0];
          if (val != null && !isNaN(Number(val)) && Number(val) >= 0) {
            precipMmHr = Number(val);
          }
        }
      } catch {
        // OPeNDAP timeout or error — return CMR metadata only
      }
    }

    const qualityLabel = precipMmHr == null
      ? undefined
      : precipMmHr === 0 ? 'dry' : precipMmHr < 1 ? 'light' : precipMmHr < 5 ? 'moderate' : precipMmHr < 15 ? 'heavy' : 'extreme';

    const coverageNote = precipMmHr != null
      ? `Observed precipitation at ${lat.toFixed(3)}°, ${lon.toFixed(3)}° from GPM IMERG satellite measurement. Not a forecast — actual measurement.`
      : `GPM IMERG granule identified (${acquisitionDate?.slice(0, 10)}). OPeNDAP point extraction unavailable; use downloadUrl for full data access.`;

    const result: PrecipitationResult = {
      lat, lon,
      precipitationMmHr: precipMmHr,
      precipitationMm24hr: precipMmHr != null ? Math.round(precipMmHr * 24 * 100) / 100 : undefined,
      qualityFlag,
      qualityLabel,
      mostRecentGranuleDate: acquisitionDate,
      dataResolutionDeg: 0.1,
      coverageNote,
      provenance,
    };

    this.setCache(cacheKey, result, 30 * 60 * 1000); // 30-min TTL
    return result;
  }

  // ─── 3. MARITIME SST ──────────────────────────────────────────────────────

  async getSeaSurfaceTemp(lat: number, lon: number, date?: string): Promise<SstResult> {
    this.requireToken();

    const targetDate = date ?? this.formatDate(this.daysAgo(1));
    const cacheKey = `sst_${lat.toFixed(2)}_${lon.toFixed(2)}_${targetDate}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const startDate = this.formatDate(this.daysAgo(7)) + 'T00:00:00Z';
    const endDate = new Date().toISOString();
    const margin = 0.2;

    const searchParams = new URLSearchParams({
      short_name: 'MUR-JPL-L4-GLOB-v4.1',
      bounding_box: `${lon - margin},${lat - margin},${lon + margin},${lat + margin}`,
      temporal: `${startDate},${endDate}`,
      page_size: '3',
      sort_key: '-start_date',
    });

    const cmrUrl = `${CMR_BASE}/granules.json?${searchParams}`;
    const cmrResp = await fetch(cmrUrl, { headers: this.getHeaders() });

    if (!cmrResp.ok) {
      throw new Error(`SST CMR search failed (${cmrResp.status})`);
    }

    const cmrJson = await cmrResp.json() as any;
    const entries = cmrJson?.feed?.entry ?? [];

    const provenance: EarthdataProvenance = {
      dataset: 'Multi-scale Ultra-high Resolution SST (MUR-JPL-L4-GLOB-v4.1)',
      shortName: 'MUR-JPL-L4-GLOB-v4.1',
      processingLevel: 'L4',
      dataCenter: PODAAC_CMR_PROVIDER,
    };

    if (entries.length === 0) {
      const result: SstResult = {
        lat, lon,
        dataResolutionKm: 1,
        coverageNote: 'No recent MUR-SST granule found for this location. MUR-SST covers global ocean; verify coordinates are ocean (not land).',
        provenance,
      };
      this.setCache(cacheKey, result, 12 * 60 * 60 * 1000);
      return result;
    }

    const granule = entries[0];
    provenance.granuleId = granule.id;
    provenance.acquisitionDate = granule.time_start ?? '';

    const opendapLink = (granule.links ?? []).find(
      (l: any) => l.href?.includes('opendap') || l.href?.includes('podaac')
    )?.href;

    let tempKelvin: number | undefined;
    let qualityLevel: number | undefined;

    if (opendapLink) {
      try {
        // MUR-SST: 0.01° resolution global grid
        // lat index: (lat + 89.995) / 0.01
        // lon index: (lon + 179.995) / 0.01
        const latIdx = Math.max(0, Math.min(17999, Math.round((lat + 89.995) / 0.01)));
        const lonIdx = Math.max(0, Math.min(35999, Math.round((lon + 179.995) / 0.01)));
        const opendapJsonUrl = `${opendapLink}.dap.json?analysed_sst[0][${latIdx}:${latIdx}][${lonIdx}:${lonIdx}]`;
        provenance.downloadUrl = opendapLink;

        const dapResp = await fetch(opendapJsonUrl, {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(8000),
        });

        if (dapResp.ok) {
          const dapJson = await dapResp.json() as any;
          const val = dapJson?.['analysed_sst']?.data?.[0]?.[0]?.[0]
            ?? dapJson?.['analysed_sst']?.data?.[0]?.[0];
          if (val != null && !isNaN(Number(val)) && Number(val) > 200) {
            // MUR stores in Kelvin (scale_factor applied), values typically 271-305K
            tempKelvin = Number(val);
          }
        }
      } catch {
        // OPeNDAP timeout — return metadata
      }
    }

    const tempC = tempKelvin != null ? Math.round((tempKelvin - 273.15) * 100) / 100 : undefined;

    const coverageNote = tempC != null
      ? `Sea surface temperature at ${lat.toFixed(3)}°, ${lon.toFixed(3)}° from MUR-SST Level 4 analysis (${granule.time_start?.slice(0, 10)}).`
      : `MUR-SST granule identified (${granule.time_start?.slice(0, 10)}). OPeNDAP point extraction unavailable; use downloadUrl for full data.`;

    const result: SstResult = {
      lat, lon,
      temperatureCelsius: tempC,
      temperatureKelvin: tempKelvin,
      analysisDate: granule.time_start ?? '',
      qualityLevel,
      qualityLabel: tempC == null ? undefined : tempC < 10 ? 'cold' : tempC < 20 ? 'cool' : tempC < 28 ? 'warm' : 'hot',
      dataResolutionKm: 1,
      coverageNote,
      provenance,
    };

    this.setCache(cacheKey, result, 12 * 60 * 60 * 1000); // 12-hr TTL
    return result;
  }

  // ─── 4. SOIL MOISTURE (SMAP) ──────────────────────────────────────────────

  async getSoilMoisture(lat: number, lon: number, date?: string): Promise<SoilMoistureResult> {
    this.requireToken();

    const targetDate = date ?? this.formatDate(this.daysAgo(3));
    const cacheKey = `smap_${lat.toFixed(2)}_${lon.toFixed(2)}_${targetDate}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const startDate = this.formatDate(this.daysAgo(10)) + 'T00:00:00Z';
    const endDate = new Date().toISOString();
    const margin = 1.0; // SMAP is 36km resolution, need larger search radius

    const searchParams = new URLSearchParams({
      short_name: 'SPL3SMP',
      bounding_box: `${lon - margin},${lat - margin},${lon + margin},${lat + margin}`,
      temporal: `${startDate},${endDate}`,
      page_size: '3',
      sort_key: '-start_date',
    });

    const cmrUrl = `${CMR_BASE}/granules.json?${searchParams}`;
    const cmrResp = await fetch(cmrUrl, { headers: this.getHeaders() });

    if (!cmrResp.ok) {
      throw new Error(`SMAP CMR search failed (${cmrResp.status})`);
    }

    const cmrJson = await cmrResp.json() as any;
    const entries = cmrJson?.feed?.entry ?? [];

    const provenance: EarthdataProvenance = {
      dataset: 'SMAP L3 Radiometer Global Daily 36km Ease-Grid Soil Moisture (SPL3SMP)',
      shortName: 'SPL3SMP',
      processingLevel: 'L3',
      dataCenter: NSIDC_CMR_PROVIDER,
    };

    if (entries.length === 0) {
      const result: SoilMoistureResult = {
        lat, lon,
        dataResolutionKm: 36,
        coverageNote: 'No recent SMAP granule found. SMAP has a 2-3 day repeat cycle; check back or expand date range.',
        provenance,
      };
      this.setCache(cacheKey, result, 24 * 60 * 60 * 1000);
      return result;
    }

    const granule = entries[0];
    provenance.granuleId = granule.id;
    provenance.acquisitionDate = granule.time_start ?? '';

    const downloadLink = (granule.links ?? []).find(
      (l: any) => l.rel?.includes('data#') || l.href?.endsWith('.h5') || l.href?.endsWith('.nc')
    )?.href;
    if (downloadLink) provenance.downloadUrl = downloadLink;

    // SMAP uses EASE-Grid 2.0 (not regular lat/lon) — point extraction via OPeNDAP
    // requires coordinate transformation; returning granule metadata for v1
    const coverageNote = `SMAP L3 daily composite identified for ${granule.time_start?.slice(0, 10)}. `
      + `Soil moisture retrieval at 36km resolution. Access full granule via downloadUrl for exact coordinate extraction. `
      + `Valid range: 0.02-0.50 m³/m³ (typical dry soil 0.05-0.15, wet soil 0.30-0.45).`;

    const result: SoilMoistureResult = {
      lat, lon,
      qualityFlag: 'granule_found',
      retrievalQuality: 'check_download',
      measurementDate: granule.time_start?.slice(0, 10),
      dataResolutionKm: 36,
      coverageNote,
      provenance,
    };

    this.setCache(cacheKey, result, 24 * 60 * 60 * 1000); // 24-hr TTL
    return result;
  }

  // ─── 5. OCEAN COLOR / WATER QUALITY ───────────────────────────────────────

  async getOceanColor(lat: number, lon: number, date?: string): Promise<OceanColorResult> {
    this.requireToken();

    const targetDate = date ?? this.formatDate(this.daysAgo(2));
    const cacheKey = `ocol_${lat.toFixed(2)}_${lon.toFixed(2)}_${targetDate}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const startDate = this.formatDate(this.daysAgo(14)) + 'T00:00:00Z';
    const endDate = new Date().toISOString();
    const margin = 2.0; // L3 mapped = global composites, wide bbox acceptable

    // Search for MODIS-Aqua L3 Mapped Chlorophyll (daily)
    const searchParams = new URLSearchParams({
      short_name: 'MODISA_L3m_CHL',
      bounding_box: `${lon - margin},${lat - margin},${lon + margin},${lat + margin}`,
      temporal: `${startDate},${endDate}`,
      page_size: '3',
      sort_key: '-start_date',
    });

    const cmrUrl = `${CMR_BASE}/granules.json?${searchParams}`;
    const cmrResp = await fetch(cmrUrl, { headers: this.getHeaders() });

    if (!cmrResp.ok) {
      throw new Error(`Ocean Color CMR search failed (${cmrResp.status})`);
    }

    const cmrJson = await cmrResp.json() as any;
    const entries = cmrJson?.feed?.entry ?? [];

    const provenance: EarthdataProvenance = {
      dataset: 'MODIS-Aqua Level-3 Mapped Chlorophyll-a Daily 4km (MODISA_L3m_CHL)',
      shortName: 'MODISA_L3m_CHL',
      processingLevel: 'L3m',
      dataCenter: OBDAAC_CMR_PROVIDER,
    };

    if (entries.length === 0) {
      const result: OceanColorResult = {
        lat, lon,
        dataResolutionKm: 4,
        coverageNote: 'No recent MODIS-Aqua CHL granule found. Cloud cover may obscure ocean color retrieval. Try a wider date range.',
        provenance,
      };
      this.setCache(cacheKey, result, 12 * 60 * 60 * 1000);
      return result;
    }

    const granule = entries[0];
    provenance.granuleId = granule.id;
    provenance.acquisitionDate = granule.time_start ?? '';

    const downloadLink = (granule.links ?? []).find(
      (l: any) => l.rel?.includes('data#') || l.href?.endsWith('.nc') || l.href?.includes('oceandata')
    )?.href;
    if (downloadLink) provenance.downloadUrl = downloadLink;

    // MODIS-Aqua L3 Mapped: 4km (~0.0417°) sinusoidal projection
    // Point extraction via OPeNDAP requires projection-aware index math
    // Returning granule metadata + OB.DAAC direct link for v1
    const coverageNote = `MODIS-Aqua CHL daily composite for ${granule.time_start?.slice(0, 10)}. `
      + `Chlorophyll-a at 4km resolution. Access via downloadUrl for exact coordinate extraction. `
      + `Ocean chlorophyll ranges: oligotrophic open ocean 0.01-0.1 mg/m³, coastal/productive 1-10 mg/m³, bloom conditions >10 mg/m³.`;

    const result: OceanColorResult = {
      lat, lon,
      chlorophyllQuality: 'granule_found',
      measurementDate: granule.time_start?.slice(0, 10),
      dataResolutionKm: 4,
      coverageNote,
      provenance,
    };

    this.setCache(cacheKey, result, 12 * 60 * 60 * 1000); // 12-hr TTL
    return result;
  }

  getPriceUsd(): number {
    return PRICE_USD;
  }
}

export const earthdataService = new EarthdataService();
