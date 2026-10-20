import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import type { CoffeePageResponse } from '../../../shared/types/coffee.ts';
import type { Database } from '../../db/client.ts';
import type { locales } from '../../db/schema/common.ts';
import {
  brand, coffeeBean, coffeeBeanMachineIssueSummary, coffeeBeanOrigin, coffeeBeanPackage, coffeeBeanRatingSummary,
  coffeeBeanSlugRedirect, coffeeBeanSpecies, coffeeBeanTranslation, machineManufacturer, species,
} from '../../db/schema/index.ts';
import { groupMachineIssues } from './machineIssues.ts';
import { thresholds, type Thresholds } from './thresholds.ts';

export type CoffeePageResult = CoffeePageResponse | { kind: 'notFound' };

const findRedirect = async (db: Database, slug: string): Promise<CoffeePageResult> => {
  const [redirect] = await db
    .select({ slug: coffeeBean.slug })
    .from(coffeeBeanSlugRedirect)
    .innerJoin(coffeeBean, eq(coffeeBean.id, coffeeBeanSlugRedirect.coffeeBeanId))
    // A coffee moved back to draft has no public page to send anyone to.
    .where(and(eq(coffeeBeanSlugRedirect.oldSlug, slug), ne(coffeeBean.status, 'DRAFT')));
  return redirect ? { kind: 'redirect', slug: redirect.slug } : { kind: 'notFound' };
};

export const getCoffeePage = async (
  db: Database,
  slug: string,
  locale: (typeof locales)[number],
  rules: Thresholds = thresholds,
): Promise<CoffeePageResult> => {
  // Starting from the summary view leaves drafts out.
  const [coffee] = await db
    .select({
      id: coffeeBean.id,
      slug: coffeeBean.slug,
      name: coffeeBean.name,
      roastLevel: coffeeBean.roastLevel,
      status: coffeeBeanRatingSummary.status,
      brandSlug: brand.slug,
      brandName: brand.name,
      brandCountryCode: brand.countryCode,
      ratingCount: coffeeBeanRatingSummary.ratingCount,
      rawMean: coffeeBeanRatingSummary.rawMean,
      score1Count: coffeeBeanRatingSummary.score1Count,
      score2Count: coffeeBeanRatingSummary.score2Count,
      score3Count: coffeeBeanRatingSummary.score3Count,
      score4Count: coffeeBeanRatingSummary.score4Count,
      score5Count: coffeeBeanRatingSummary.score5Count,
    })
    .from(coffeeBeanRatingSummary)
    .innerJoin(coffeeBean, eq(coffeeBean.id, coffeeBeanRatingSummary.coffeeBeanId))
    .innerJoin(brand, eq(brand.id, coffeeBean.brandId))
    .where(eq(coffeeBean.slug, slug));
  if (!coffee) {
    return findRedirect(db, slug);
  }

  // One query at a time: db may be a transaction, which is a single connection.
  const [translation] = await db
    .select({ description: coffeeBeanTranslation.description })
    .from(coffeeBeanTranslation)
    .where(and(eq(coffeeBeanTranslation.coffeeBeanId, coffee.id), eq(coffeeBeanTranslation.locale, locale)));
  const packages = await db
    .select({ sizeG: coffeeBeanPackage.sizeG, gtin: coffeeBeanPackage.gtin })
    .from(coffeeBeanPackage)
    .where(eq(coffeeBeanPackage.coffeeBeanId, coffee.id))
    .orderBy(desc(coffeeBeanPackage.sizeG), asc(coffeeBeanPackage.id));
  const speciesRows = await db
    .select({ code: coffeeBeanSpecies.speciesCode, percentage: coffeeBeanSpecies.percentage })
    .from(coffeeBeanSpecies)
    .innerJoin(species, eq(species.code, coffeeBeanSpecies.speciesCode))
    .where(eq(coffeeBeanSpecies.coffeeBeanId, coffee.id))
    // Postgres sorts NULLs first in descending order; unquantified species go last.
    .orderBy(sql`${coffeeBeanSpecies.percentage} DESC NULLS LAST`, asc(species.sortOrder));
  const origins = await db
    .select({ countryCode: coffeeBeanOrigin.countryCode })
    .from(coffeeBeanOrigin)
    .where(eq(coffeeBeanOrigin.coffeeBeanId, coffee.id))
    .orderBy(asc(coffeeBeanOrigin.countryCode));
  const issueRows = await db
    .select({
      machineKind: coffeeBeanMachineIssueSummary.machineKind,
      manufacturerName: machineManufacturer.name,
      answered: coffeeBeanMachineIssueSummary.answeredCount,
      withIssues: coffeeBeanMachineIssueSummary.withIssuesCount,
    })
    .from(coffeeBeanMachineIssueSummary)
    .leftJoin(machineManufacturer, eq(machineManufacturer.id, coffeeBeanMachineIssueSummary.manufacturerId))
    .where(eq(coffeeBeanMachineIssueSummary.coffeeBeanId, coffee.id));

  return {
    kind: 'coffee',
    coffee: {
      slug: coffee.slug,
      name: coffee.name,
      archived: coffee.status === 'ARCHIVED',
      roastLevel: coffee.roastLevel,
      brand: { slug: coffee.brandSlug, name: coffee.brandName, countryCode: coffee.brandCountryCode },
      description: translation?.description ?? null,
      packages,
      species: speciesRows,
      origins: origins.map(origin => origin.countryCode),
      ratingCount: coffee.ratingCount,
      rawMean: coffee.rawMean,
      scoreCounts: [coffee.score1Count, coffee.score2Count, coffee.score3Count, coffee.score4Count, coffee.score5Count],
      machineIssues: groupMachineIssues(issueRows, rules),
    },
  };
};
