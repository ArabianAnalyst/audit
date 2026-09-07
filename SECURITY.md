# Security

Thank you for looking. This file says what is covered, how to report, and what happens after.

## What this covers

The `@olurabian/audit` package and the Agent Payment Security Audit engine behind it, published from this repository. The versions that receive fixes are the latest release and the commit on the default branch.

## How to report

Use GitHub private vulnerability reporting on this repository (the Security tab, then Report a vulnerability). If that is not available to you, email araba@olurabian.com with the subject "Security" and enough detail to reproduce. Please do not open a public issue for anything exploitable.

## What happens next

You get an acknowledgement within three working days. A fix or a mitigation follows as fast as the severity demands, with a target of fourteen days for anything a compromised agent could use to move money or rewrite a record. You are credited in the release notes unless you ask not to be. Disclosure is coordinated, after the fix ships or after ninety days, whichever comes first.

## What is in scope

Anything that lets an agent act outside policy, read a credential it should not hold, forge or misdirect a spend, edit a receipt without the chain breaking, or make a verifier say ok when it should not. Supply-chain problems in the published artefacts count too.

## What is out of scope

Reports that need a compromised operator account, denial of service by resource exhaustion on a self-hosted instance, and findings in third-party services this project talks to. Report those to the service.

## The threat model

The whole stack is held to the threat model in the Purse README, https://github.com/ArabianAnalyst/purse#threat-model.
