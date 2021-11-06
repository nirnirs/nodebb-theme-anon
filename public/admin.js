'use strict';
/* globals $, app */

define('admin/plugins/anon', ['settings'], function(Settings) {

	var ACP = {};

	ACP.init = function() {
		Settings.load('anon', $('.anon-settings'));

		$('#save').on('click', function() {
			Settings.save('anon', $('.anon-settings'), function() {
				app.alert({
					type: 'success',
					alert_id: 'anon-saved',
					title: 'Settings Saved',
					message: 'Anon settings saved'
				});
			});
		});
	};

	return ACP;
});