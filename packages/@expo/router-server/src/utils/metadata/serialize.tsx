import type { Metadata } from 'expo-server';
import type { ReactNode } from 'react';

import { renderMetadataTags } from './render';
import { resolveMetadata } from './resolve';
import { isTitleTag } from './types';

// HTML names that are not valid React DOM props. `render.ts` keeps those names so
// `serializeMetadataToTags` still emits HTML. The renderer only produces `hreflang`.
const HTML_ATTRIBUTE_TO_REACT_PROP: Record<string, string> = {
  hreflang: 'hrefLang',
};

export function serializeMetadataToTags(metadata: Metadata) {
  return renderMetadataTags(resolveMetadata(metadata));
}

export function serializeMetadataToReact(metadata: Metadata): ReactNode[] {
  return serializeMetadataToTags(metadata).map((tag, index) => {
    if (isTitleTag(tag)) {
      return <title key="metadata-title">{tag.content}</title>;
    }

    return (
      <tag.tagName key={`metadata-${tag.tagName}-${index}`} {...toReactProps(tag.attributes)} />
    );
  });
}

function toReactProps(attributes: Record<string, string>): Record<string, string> {
  const props: Record<string, string> = {};

  for (const [name, value] of Object.entries(attributes)) {
    props[HTML_ATTRIBUTE_TO_REACT_PROP[name] ?? name] = value;
  }

  return props;
}
