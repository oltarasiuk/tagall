import { getActiveProviderAttributions } from "~/server/api/modules/media/constants/provider-attribution.const";

/**
 * Server component on purpose: which sources are credited follows from which
 * providers have credentials, and that only exists on the server. It is not
 * exported from the shared barrel so no client component can pull the registry
 * (and its env access) into the browser bundle.
 *
 * Rendered by the root layout because RAWG requires the backlink on every page
 * that shows their data, item pages included — a single search-page credit
 * would not satisfy that.
 */
export const DataSourcesFooter = () => {
  const attributions = getActiveProviderAttributions();

  if (attributions.length === 0) return null;

  const notices = attributions
    .map((attribution) => attribution.notice)
    .filter((notice): notice is string => !!notice);

  return (
    <footer className="mx-auto max-w-screen-xl px-8 pb-8 pt-2 text-xs text-muted-foreground">
      <p>
        Metadata and artwork from{" "}
        {attributions.map((attribution, index) => (
          <span key={attribution.provider}>
            {index > 0 && ", "}
            <a
              href={attribution.url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {attribution.label}
            </a>
          </span>
        ))}
        .
      </p>

      {notices.length > 0 && <p className="mt-1">{notices.join(" ")}</p>}
    </footer>
  );
};
