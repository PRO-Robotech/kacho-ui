.PHONY: install dev build docker lint clean

install:
	npm install

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

docker:
	docker build -t kacho-ui:dev -f Dockerfile .

clean:
	rm -rf node_modules dist
