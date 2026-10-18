# Contributing to Open Rails Data Agent

Thank you for considering contributing to this project! Please follow these guidelines to help us maintain quality and consistency.

## Development Setup

1. Clone the repository.
2. Install dependencies: `npm install`
3. To run the worker locally: `cd worker && npx wrangler dev`
4. To register the agent on Celo Mainnet: `node agent/register.mjs mainnet` (ensure you have funds for gas via fee abstraction).
5. To test a purchase: `node agent/buyer-e2e.mjs`

## Code Style

- Please maintain the existing coding style.
- Run `npm run lint` if a linter is added in the future.
- Keep commits focused and descriptive.

## Reporting Issues

Use the GitHub issue tracker to report bugs or suggest features.

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 license of this project.
