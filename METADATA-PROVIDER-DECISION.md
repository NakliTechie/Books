# Books metadata and cover provider decision

> **Recommendation:** Adapt Open Library as an optional, on-demand ISBN lookup.
>
> **Status:** Evidence complete; provider remains disabled pending approval of
> the privacy and attribution policy.
>
> **Date:** 2026-07-30

## Recommendation

Use Open Library only when the user explicitly asks Books to look up one or
more selected works. Match by a strong publication identifier—prefer ISBN—then
show a preflight diff before changing title, authors, language, publication
data, identifiers, or cover provenance.

Do not:

- query every imported filename or title automatically;
- make Open Library the catalog database;
- crawl covers or metadata;
- overwrite user-edited or source-authored metadata;
- infer edition identity from a fuzzy title/author result;
- send a library-wide list to a provider.

Open Library's current API guidance favors low-volume, human-facing discovery,
asks clients to cache responses, identifies default traffic at one request per
second (three for identified clients), and explicitly says the service is not
a third-party bulk backend:
[Open Library API guidance](https://openlibrary.org/developers/api).

Its cover endpoint supports ISBN, OLID, Cover ID, OCLC, and LCCN. ISBN and
other non-Open-Library IDs are rate-limited to 100 requests per IP per five
minutes, bulk crawling is forbidden, and a courtesy link is requested:
[Open Library Covers API](https://openlibrary.org/dev/docs/api/covers).

## Provider disposition

| Provider | Disposition | Reason |
|---|---|---|
| Embedded/source metadata | Adopt as authority | Local, edition-specific, no disclosure |
| User edits | Adopt as highest-priority overlay | User-owned and portable |
| Open Library | Adapt, opt-in lookup | Open, low-volume discovery fit; requires caching, identification, attribution, and privacy consent |
| Google Books | Separate optional BYOK provider | Requires project identification/API key for public requests and prominent attribution/linking; licensed data is not a general replacement backend |
| Bulk metadata services | Reject for core | Violates private, local-first import and adds a catalog dependency |

Google Books remains a separate provider rather than an automatic fallback.
Its documentation requires requests to identify an application with an API key
or OAuth token, and its branding rules require attribution and prominent links
when displaying results:
[Google Books API](https://developers.google.com/books/docs/v1/using),
[Google Books branding](https://developers.google.com/books/branding).

## Portable record

Accepted provider fields must retain:

```json
{
  "provider": "open-library",
  "providerRecordId": "OL…M",
  "matchedBy": { "type": "isbn-13", "value": "…" },
  "fetchedAt": "ISO-8601",
  "sourceUrl": "https://openlibrary.org/…",
  "fieldProvenance": {
    "title": "open-library",
    "authors": "open-library",
    "cover": "open-library"
  }
}
```

The raw response is a cache, not canonical state. Accepted fields enter the
work manifest with provenance; rejected suggestions can be discarded. A
later refresh always presents a diff and never erases a user override.

## Cover policy

- Prefer the authored package cover or PDF page-one cache already produced
  locally.
- Offer a provider cover only when no authored cover exists or the user asks
  to replace it.
- Cache only the selected size and retain provider ID, source URL, fetch time,
  and attribution link.
- A missing/blocked provider image falls back to the existing typographic
  cover without affecting reading.
- Provider covers remain removable cached media.

## Approval gate

Before implementation, approve:

1. whether looking up an ISBN/title at Open Library counts as standing remote
   consent or requires confirmation for each lookup session;
2. the application contact used for an identified Open Library `User-Agent`;
3. where the Open Library courtesy link and provenance appear;
4. whether Google Books should be offered as a user-configured fallback.
