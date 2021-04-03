// CREDITS: https://gist.github.com/kosamari/7c5d1e8449b2fbc97d372675f16b566e

var APP_PREFIX = 'bChat'
var VERSION = 'version_01'
var CACHE_NAME = APP_PREFIX + VERSION
var URLS = [
	'/bChat/',
	'/bChat/index.html',
	'/bChat/build/bundle.css',
	'/bChat/build/bundle.js',
]

// Respond with cached resources
self.addEventListener('fetch', function (e) {
	e.respondWith(
		caches.match(e.request).then(function (request) {
			return request || fetch(e.request)
		})
	)
})

// Cache resources
self.addEventListener('install', function (e) {
	e.waitUntil(
		caches.open(CACHE_NAME).then(function (cache) {
			return cache.addAll(URLS)
		})
	)
})

// Delete outdated caches
self.addEventListener('activate', function (e) {
	e.waitUntil(
		caches.keys().then(function (keyList) {
			const cacheWhitelist = keyList.filter(function (key) {
				return key.indexOf(APP_PREFIX)
			})
			cacheWhitelist.push(CACHE_NAME)

			return Promise.all(keyList.map((key, i) => {
				if (cacheWhitelist.indexOf(key) === -1) {
					return caches.delete(keyList[i])
				}
			}))
		})
	)
})
