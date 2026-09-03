import { IDatabase, getDatabase } from '@libs/db';

export class LiveOpsService {
  private db: IDatabase;

  private featureFlags: Record<string, boolean> = {
    district_rotation_enabled: true,
    skyline_pass_active: true,
    ads_enabled: true,
    dda_tuning_v2: false
  };

  constructor(db?: IDatabase) {
    this.db = db || getDatabase();
  }

  async getConfig() {
    const packs = await this.db.getActiveContentPacks();
    const activeDistricts = packs.map(p => ({
      district_id: p.district_id,
      name: p.district_id === 'neo-marina' ? 'Neo Marina' : p.district_id,
      active_content_pack_version: p.version,
      cdn_url: p.cdn_url,
      checksum: p.checksum
    }));

    return {
      active_districts: activeDistricts,
      feature_flags: this.featureFlags
    };
  }

  setFeatureFlag(key: string, value: boolean) {
    this.featureFlags[key] = value;
  }
}
