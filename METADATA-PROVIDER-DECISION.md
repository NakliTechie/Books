# Books metadata and cover provider decision

> **Recommendation:** Adapt Open Library as an optional, on-demand ISBN lookup.
>
> **Status:** Approved and implemented as an explicit per-book action. There is
> no library-wide lookup, automatic import request, or Google Books fallback.
>
> **Date:** 2026-07-31

## Recommendation

Use Open Library only when the user explicitly asks Books to look up the work
whose details are open. Match by a strong publication identifier—prefer
ISBN—show bounded candidates, and separately let the user apply missing
metadata or choose a provider cover.

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

## Implemented policy

- Clicking **Look up this book** is the consent action. The disclosure names
  the ISBN/title/author fields and says the action never runs across the whole
  library.
- Results are limited to five, omit credentials and referrer data, and are not
  persisted unless the user applies one. Identical requests share a bounded
  in-memory session cache, and network requests are spaced at one per second.
- Applying metadata fills only missing or filename-derived fields; user and
  source-authored title/author values win.
- Each result links to its Open Library work record. Accepted fields and a
  selected cover retain provider, record ID, source URL, match, and fetch
  provenance in the portable manifest.
- A cover is downloaded only after **Use this cover**, is capped at 6 MB, and
  is cached inside the active backend.
- Google Books remains out of the core provider list.

The browser cannot set an identified `User-Agent`; the implementation
therefore stays a low-volume, human-triggered client and makes no bulk calls.
