# Écrin (working name)

A digital home for a watch collection. The watch box is the entry point; the data underneath is an ownership record.

**Live prototype:** https://claude.ai/artifact/RKECoYMigKedVVQBTiR3W9

The app is a single file, `app/index.html`, hosted as a claude.ai Artifact with its built-in database and user identity.
That keeps the prototype free of external infrastructure while we test the product. When we move to Next.js + Supabase,
the data shapes below map directly onto the planned tables.

## Data layout

| Path | Visibility | Future table |
|---|---|---|
| `data/users/<uid>/profile` | private to the collector | `profiles`, `displays` (boxes: layout, trays, slot → watch) |
| `data/users/<uid>/profile/watches/<id>` | private to the collector | `watches` (`watch.*`) + `ownerships` (`ownership.*`) |
| `media/<uid>/th\|ph/<photoId>` | written only by its owner | `watch_media` + Storage |
| `showcases/<uid>` | readable by people with the link | public projection (`get_public_collection`) |
| `links/<token>` | unguessable token → owner | `collections.share_slug` |

- **Collection = ownership, box = presentation.** Watches exist independently of the box. A box has a 6/8/12 layout and any number of trays; a watch can be outside the box.
- **Ownership start ≠ purchase.** `ownership.startedOn` and `ownership.acquisition` (purchase, gift, inheritance, transfer, other) are separate from the optional `ownership.purchase` block. Money is always `{amount, currency}`.
- **Privacy by construction.** The showcase only ever contains brand, model, reference, year and photos. Serial, price, source, acquisition, condition and notes live only in the private subtree.

## Local preview

Open `app/index.html` wrapped in a basic HTML document in a browser. Outside claude.ai it uses an in-browser store, and `?as=<id>` simulates a second person.
