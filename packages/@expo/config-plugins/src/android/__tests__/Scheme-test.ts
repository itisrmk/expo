import { resolve } from 'path';

import rnFixture from '../../plugins/__tests__/fixtures/react-native-project';
import * as XML from '../../utils/XML';
import type { AndroidManifest } from '../Manifest';
import { getMainActivity, readAndroidManifestAsync } from '../Manifest';
import {
  appendScheme,
  ensureManifestHasValidIntentFilter,
  getScheme,
  getSchemesFromManifest,
  hasScheme,
  removeScheme,
  setScheme,
} from '../Scheme';

async function getFixtureManifestAsync() {
  return (await XML.parseXMLAsync(
    rnFixture['android/app/src/main/AndroidManifest.xml']
  )) as AndroidManifest;
}

const fixturesPath = resolve(__dirname, 'fixtures');
const sampleManifestWithHostPath = resolve(
  fixturesPath,
  'react-native-AndroidManifest-with-host.xml'
);

describe('scheme', () => {
  it(`returns empty array if no scheme is provided`, () => {
    expect(getScheme({})).toStrictEqual([]);
  });

  it(`returns the scheme if provided`, () => {
    expect(getScheme({ scheme: 'myapp' })).toStrictEqual(['myapp']);
    expect(getScheme({ scheme: ['other', 'myapp'] })).toStrictEqual(['other', 'myapp']);
    expect(
      getScheme({
        scheme: [
          'other',
          'myapp',
          // @ts-expect-error
          null,
        ],
      })
    ).toStrictEqual(['other', 'myapp']);
  });

  it('does not add scheme if none provided', async () => {
    let androidManifestJson = await getFixtureManifestAsync();
    androidManifestJson = await setScheme({}, androidManifestJson);

    expect(androidManifestJson).toEqual(androidManifestJson);
  });

  it('adds scheme to android manifest', async () => {
    let androidManifestJson = await getFixtureManifestAsync();
    androidManifestJson = await setScheme(
      {
        scheme: 'myapp',
        android: {
          scheme: ['android-only'],
          package: 'com.demo.value',
        },
      },
      androidManifestJson
    );

    const mainActivity = getMainActivity(androidManifestJson);
    const intentFilters = mainActivity!['intent-filter']!;

    const schemeIntent: string[] = [];

    for (const intent of intentFilters) {
      if ('data' in intent) {
        for (const dataFilter of intent.data!) {
          const possibleScheme = dataFilter.$['android:scheme'];
          if (possibleScheme) {
            schemeIntent.push(possibleScheme);
          }
        }
      }
    }

    expect(schemeIntent).toStrictEqual(['myapp', 'android-only']);
  });
});

function removeSingleTaskFromActivities(manifest: AndroidManifest) {
  for (const application of manifest.manifest.application ?? []) {
    for (const activity of application.activity ?? []) {
      if (activity.$['android:launchMode'] === 'singleTask') {
        delete activity.$['android:launchMode'];
      }
    }
  }

  return manifest;
}

describe('Schemes', () => {
  it(`ensure manifest has valid intent filter added`, async () => {
    const manifest = await getFixtureManifestAsync();
    const manifestHasValidIntentFilter = ensureManifestHasValidIntentFilter(manifest);
    expect(manifestHasValidIntentFilter).toBe(true);
  });

  it(`detect if no singleTask Activity exists`, async () => {
    const manifest = await getFixtureManifestAsync();
    removeSingleTaskFromActivities(manifest);

    expect(ensureManifestHasValidIntentFilter(manifest)).toBe(false);
  });

  it(`adds and removes a new scheme`, async () => {
    const manifest = await getFixtureManifestAsync();
    ensureManifestHasValidIntentFilter(manifest);

    const modifiedManifest = appendScheme('myapp.test', manifest);
    const schemes = getSchemesFromManifest(modifiedManifest);
    expect(schemes).toContain('myapp.test');
    const removedManifest = removeScheme('myapp.test', manifest);
    expect(getSchemesFromManifest(removedManifest)).not.toContain('myapp.test');
  });

  it(`get all schemes for the host`, async () => {
    const manifest = await readAndroidManifestAsync(sampleManifestWithHostPath);
    ensureManifestHasValidIntentFilter(manifest);
    expect(hasScheme('longestschemewiththehost', manifest)).toBe(true);

    const modifiedManifest = appendScheme('myapp.test', manifest);
    let schemes = getSchemesFromManifest(modifiedManifest, 'any-host');
    expect(schemes).toContain('myapp.test');
    expect(schemes).not.toContain('longestschemewiththehost');

    schemes = getSchemesFromManifest(modifiedManifest, 'expo-development-client');
    expect(schemes).toContain('myapp.test');
    expect(schemes).toContain('longestschemewiththehost');
  });

  it(`detect when a duplicate might be added`, async () => {
    const manifest = await getFixtureManifestAsync();
    ensureManifestHasValidIntentFilter(manifest);

    const modifiedManifest = appendScheme('myapp.test', manifest);
    expect(hasScheme('myapp.test', modifiedManifest)).toBe(true);
  });

  it(`detect a non-existent scheme`, async () => {
    const manifest = await getFixtureManifestAsync();

    expect(hasScheme('myapp.test', manifest)).toBe(false);
  });
});

function setMainActivityLaunchMode(manifest: AndroidManifest, launchMode: string) {
  const mainActivity = getMainActivity(manifest)!;
  mainActivity.$['android:launchMode'] = launchMode;
  return manifest;
}

function addRedirectSchemes(manifest: AndroidManifest, schemes: string[]) {
  const mainActivity = getMainActivity(manifest)!;
  mainActivity['intent-filter'] = [
    ...(mainActivity['intent-filter'] ?? []),
    {
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [
        { $: { 'android:name': 'android.intent.category.DEFAULT' } },
        { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
      ],
      data: schemes.map((scheme) => ({ $: { 'android:scheme': scheme } })),
    },
  ];
  return manifest;
}

function readRedirectSchemes(manifest: AndroidManifest): string[] {
  const mainActivity = getMainActivity(manifest)!;
  return (mainActivity['intent-filter'] ?? []).flatMap((intentFilter) => {
    const actions = intentFilter.action?.map((action) => action.$['android:name']) ?? [];
    const categories = intentFilter.category?.map((category) => category.$['android:name']) ?? [];
    if (
      !actions.includes('android.intent.action.VIEW') ||
      categories.includes('android.intent.category.LAUNCHER')
    ) {
      return [];
    }
    return (intentFilter.data ?? [])
      .map((data) => data?.$?.['android:scheme'])
      .filter((scheme): scheme is string => typeof scheme === 'string');
  });
}

describe('singleTop MainActivity', () => {
  it(`reads schemes from a singleTop MainActivity`, async () => {
    const manifest = setMainActivityLaunchMode(await getFixtureManifestAsync(), 'singleTop');
    addRedirectSchemes(manifest, ['repro', 'exp+repro']);

    expect(getSchemesFromManifest(manifest)).toEqual(['repro', 'exp+repro']);
  });

  it(`adds a valid intent filter to a singleTop MainActivity`, async () => {
    const manifest = setMainActivityLaunchMode(await getFixtureManifestAsync(), 'singleTop');

    expect(ensureManifestHasValidIntentFilter(manifest)).toBe(true);
    expect(readRedirectSchemes(manifest)).toEqual([]);
    expect(
      getMainActivity(manifest)!['intent-filter']?.some((intentFilter) => {
        const actions = intentFilter.action?.map((action) => action.$['android:name']) ?? [];
        const categories =
          intentFilter.category?.map((category) => category.$['android:name']) ?? [];
        return (
          actions.includes('android.intent.action.VIEW') &&
          categories.includes('android.intent.category.BROWSABLE') &&
          !categories.includes('android.intent.category.LAUNCHER')
        );
      })
    ).toBe(true);
  });

  it(`appends a scheme to a singleTop MainActivity`, async () => {
    const manifest = setMainActivityLaunchMode(await getFixtureManifestAsync(), 'singleTop');

    appendScheme('repro', manifest);

    expect(readRedirectSchemes(manifest)).toEqual(['repro']);
    expect(getSchemesFromManifest(manifest)).toEqual(['repro']);
  });

  it(`removes a scheme from a singleTop MainActivity`, async () => {
    const manifest = setMainActivityLaunchMode(await getFixtureManifestAsync(), 'singleTop');
    addRedirectSchemes(manifest, ['repro', 'exp+repro']);

    removeScheme('repro', manifest);

    expect(readRedirectSchemes(manifest)).toEqual(['exp+repro']);
    expect(getSchemesFromManifest(manifest)).toEqual(['exp+repro']);
  });
});
