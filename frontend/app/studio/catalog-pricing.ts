import type { StudioCreditRules } from "./pricing";

// Synced with the server catalog by the September 2026 pricing migration.
// Audit: maintenance/studio-pricing-30pct.json. Rates round up per request.
export const studioCatalogPricing: Record<string, { credit_cost: number; credit_rules: StudioCreditRules }> = {
  "nano-banana-2-1k": {
    "credit_cost": 8,
    "credit_rules": {
      "keys": [
        "resolution"
      ],
      "rates": {
        "1K": 7.14375012,
        "2K": 10.71562517,
        "4K": 16.07343776
      },
      "strategy": "matrix"
    }
  },
  "flux-2-flex-1k": {
    "credit_cost": 13,
    "credit_rules": {
      "keys": [
        "resolution"
      ],
      "rates": {
        "1K": 12.5015627,
        "2K": 21.43125034
      },
      "strategy": "matrix"
    }
  },
  "gpt-image-2": {
    "credit_cost": 6,
    "credit_rules": {
      "keys": [
        "resolution"
      ],
      "rates": {
        "1K": 5.35781259,
        "2K": 8.92968764,
        "4K": 14.28750023
      },
      "strategy": "matrix"
    }
  },
  "gpt-image-1-5": {
    "credit_cost": 4,
    "credit_rules": {
      "keys": [
        "quality"
      ],
      "rates": {
        "medium": 3.57187506,
        "high": 19.64531281
      },
      "strategy": "matrix"
    }
  },
  "seedream-5-lite": {
    "credit_cost": 5,
    "credit_rules": {
      "strategy": "fixed"
    }
  },
  "seedream-5-pro": {
    "credit_cost": 7,
    "credit_rules": {
      "keys": [
        "quality"
      ],
      "rates": {
        "basic": 6.25078135,
        "high": 12.5015627
      },
      "strategy": "matrix"
    }
  },
  "seedance-1-5-pro-720p-8s": {
    "credit_cost": 26,
    "credit_rules": {
      "keys": [
        "resolution",
        "generate_audio"
      ],
      "rates": {
        "480p|false": 1.56269534,
        "480p|true": 3.12539068,
        "720p|false": 3.12539068,
        "720p|true": 6.25078135,
        "1080p|false": 6.69726573,
        "1080p|true": 13.39453146
      },
      "strategy": "matrix",
      "multiplierKey": "duration"
    }
  },
  "kling-3-video": {
    "credit_cost": 63,
    "credit_rules": {
      "keys": [
        "mode",
        "sound"
      ],
      "rates": {
        "std|false": 12.5015627,
        "std|true": 17.85937528,
        "pro|false": 16.07343776,
        "pro|true": 24.11015663,
        "4K|false": 59.82890719,
        "4K|true": 59.82890719
      },
      "strategy": "matrix",
      "multiplierKey": "duration"
    }
  },
  "wan-3-video": {
    "credit_cost": 36,
    "credit_rules": {
      "keys": [
        "resolution"
      ],
      "rates": {
        "480P": 7.14375012,
        "720P": 16.07343776,
        "1080P": 28.57500045
      },
      "strategy": "matrix",
      "multiplierKey": "duration"
    }
  }
};
