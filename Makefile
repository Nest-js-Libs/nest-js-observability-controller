.PHONY: help publish-patch publish-minor publish-major test build

help:
	@echo "Available commands:"
	@echo "  make publish-patch  - Increment patch version and publish"
	@echo "  make publish-minor  - Increment minor version and publish"
	@echo "  make publish-major  - Increment major version and publish"
	@echo "  make test          - Run tests"
	@echo "  make build         - Build the package"

build:
	npm run build

test:
	npm run test

publish-patch:
	npm run build
	rm -rf dist/example
	npm version patch
	npm publish --access public
	git push --follow-tags

publish-minor:
	npm run build
	rm -rf dist/example
	npm version minor
	npm publish --access public
	git push --follow-tags

publish-major:
	npm run build
	rm -rf dist/example
	npm version major
	npm publish --access public
	git push --follow-tags