/*
 * @Author: sunhaolin@hotoa.com
 * @Date: 2022-03-04 17:02:52
 * @LastEditors: sunhaolin@hotoa.com
 * @LastEditTime: 2022-12-02 16:12:12
 * @Description: 
 */
"use strict";
const project = require('./package.json');
const packageName = project.name;
const packageLoader = require('@steedos/service-package-loader');

/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 * 软件包服务启动后也需要抛出事件。
 */
module.exports = {
	name: packageName,
	namespace: "steedos",
	mixins: [packageLoader],
	/**
	 * Settings
	 */
	settings: {
		packageInfo: {
			path: __dirname,
			name: packageName
		}
	},

	/**
	 * Dependencies
	 */
	dependencies: [],

	/**
	 * Actions
	 */
	actions: {

	},

	/**
	 * Events
	 */
	events: {

    },
	/**
	 * Methods
	 */
	methods: {

	},

	/**
	 * Service created lifecycle event handler
	 */
	async created() {

	},

	/**
     * Service started lifecycle event handler
     */
	 async started() {

    },

	/**
	 * Service stopped lifecycle event handler
	 */
	async stopped() {

	}
};
