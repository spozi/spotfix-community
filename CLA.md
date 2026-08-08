# Contributor License Agreement

SpotFix Community is released under the Apache License, Version 2.0. To keep the
project's licensing durable — and to allow the maintainers to offer the software
under additional terms alongside the Apache-2.0 release — every contributor must
agree to this Contributor License Agreement (CLA) before their first
contribution is merged.

Throughout this document, **"the Project Owner"** means
`[LEGAL ENTITY NAME — see "Before adopting this document" below]`, **"You"**
means the individual or legal entity agreeing to these terms, and
**"Contribution"** means any original work of authorship You intentionally
submit to the Project Owner for inclusion in SpotFix Community, in any form and
through any medium, including but not limited to pull requests, patches, issue
attachments and electronic messages.

This document has two parts. Individuals sign Part A. Entities contributing
through their employees sign Part B in addition to Part A.

## Why this exists

The Apache-2.0 license governs what *recipients* of the software may do. It does
not, on its own, give the Project Owner the rights it needs to relicense
contributed code later — for example to publish a commercially licensed edition
alongside the community edition, or to change the community license in response
to a future legal need.

Without this agreement, once contributions from multiple authors are merged, the
project's license is effectively frozen forever, because changing it would
require tracking down and obtaining permission from every past contributor.

This CLA does **not** take your rights away. Section A.1 is a *license* grant,
not an assignment: You keep full ownership of your Contribution and remain free
to use, sell, relicense and redistribute it however you wish. The community
edition remains Apache-2.0.

## Part A — Individual Contributor License Agreement

### A.1 Copyright license

You retain all right, title and interest in and to Your Contributions.

Subject to the terms of this agreement, You grant to the Project Owner and to
recipients of software distributed by the Project Owner a perpetual, worldwide,
non-exclusive, no-charge, royalty-free, irrevocable copyright license to
reproduce, prepare derivative works of, publicly display, publicly perform,
sublicense and distribute Your Contributions and such derivative works.

You further grant the Project Owner the right to license Your Contributions —
and derivative works of them — under any license terms the Project Owner
chooses, including without limitation the Apache License 2.0, other open-source
licenses, and proprietary or commercial license terms.

### A.2 Patent license

Subject to the terms of this agreement, You grant to the Project Owner and to
recipients of software distributed by the Project Owner a perpetual, worldwide,
non-exclusive, no-charge, royalty-free, irrevocable (except as stated in this
section) patent license to make, have made, use, offer to sell, sell, import and
otherwise transfer Your Contributions, where such license applies only to those
patent claims licensable by You that are necessarily infringed by Your
Contributions alone or by combination of Your Contributions with the work to
which they were submitted.

If any entity institutes patent litigation against You or any other entity
alleging that Your Contribution, or the work to which You contributed,
constitutes direct or contributory patent infringement, then any patent licenses
granted to that entity under this agreement for that Contribution or work
terminate as of the date such litigation is filed.

### A.3 Your representations

You represent that:

1. You are legally entitled to grant the above licenses.
2. Each of Your Contributions is Your original creation, or You have the
   necessary rights to submit it under these terms.
3. If your employer has rights to intellectual property that You create, You
   have received permission to make the Contribution on behalf of that employer,
   your employer has waived such rights, or your employer has signed Part B.
4. Your Contributions do not include third-party material subject to a
   different license, unless You have identified that material, its source and
   its license in the submission itself.
5. Your Contributions contain no real tenant data, credentials, private
   infrastructure details, or personal data of real individuals, consistent with
   `CONTRIBUTING.md`.

### A.4 No obligation and no warranty

You are not expected to provide support for Your Contributions. Except for the
representations in Section A.3, Your Contributions are provided "AS IS", without
warranty of any kind, express or implied.

The Project Owner is under no obligation to accept, merge or continue to
distribute any Contribution.

### A.5 Notice of inaccuracy

You agree to notify the Project Owner in writing if You become aware of any fact
or circumstance that would make any representation in Section A.3 inaccurate.

## Part B — Entity (Corporate) Contributor License Agreement

This part applies where Contributions are made by employees or contractors in
the course of work for a legal entity, and the entity — rather than the
individual — holds the resulting intellectual property.

By signing Part B, the entity:

1. Makes the same grants and representations set out in Sections A.1 through
   A.5, on its own behalf and with respect to all Contributions submitted by its
   designated contributors.
2. Represents that the person signing is authorised to bind the entity.
3. Maintains a list of designated contributors authorised to submit
   Contributions on its behalf, and notifies the Project Owner in writing when
   that list changes.

An entity signature does not remove the requirement for each individual
contributor to agree to Part A.

## How to sign

Sign once. The agreement then covers all of Your future Contributions to
SpotFix Community, and You do not need to sign again for later pull requests.

**Individuals** — comment the following on your first pull request:

```text
I have read the SpotFix Community CLA and I agree to its terms.

Full name:
GitHub username:
Email:
Date:
```

**Entities** — send Part B, signed by an authorised representative, to the
contact listed in `SECURITY.md`, together with the initial list of designated
contributors.

Maintainers record signatures before merging a first-time contributor's work. A
pull request from an unsigned contributor will be held, not rejected — we will
ask you to sign.

## Developer Certificate of Origin

In addition to this CLA, sign your commits off under the
[Developer Certificate of Origin 1.1](https://developercertificate.org/):

```bash
git commit -s -m "your message"
```

This appends a `Signed-off-by:` trailer asserting that you have the right to
submit the work. The CLA establishes the licensing grant once; the DCO records
per-commit provenance in Git history itself.

## Before adopting this document

> **This section is a checklist for the maintainers and should be deleted once
> the items are resolved.**

This CLA is a draft modelled on widely used templates (the Apache Individual
and Corporate CLAs, extended with the multi-licensing grant in Section A.1 that
those templates omit). **It has not been reviewed by a lawyer.** Have counsel in
your jurisdiction review it before you rely on it, particularly Section A.1 and
Part B.

Outstanding items:

1. **Name the Project Owner.** No legal entity or copyright holder is currently
   declared anywhere in this repository. Decide whether the rights holder is an
   individual, a company, or a foundation, then replace
   `[LEGAL ENTITY NAME]` above. A CLA granting rights to an entity that does not
   exist yet is not enforceable.
2. **Fill in the `LICENSE` appendix and add a `NOTICE` file.** The Apache-2.0
   text in `LICENSE` still carries the unfilled boilerplate appendix, so the
   project asserts no copyright ownership at all today.
3. **Choose an enforcement mechanism.** Manual tracking works at low volume; a
   CLA assistant bot that gates pull requests scales better and keeps an
   auditable record.
4. **Decide the effective date and handle work already merged.** Contributions
   merged before this document takes effect are covered only by Apache-2.0. If
   any external contributions already exist, collect retroactive signatures now,
   while the contributor list is still small.
