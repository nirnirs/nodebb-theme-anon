'use strict';

const nconf = require.main.require('nconf');
const winston = require.main.require('winston');
const meta = require.main.require('./src/meta');
const user = require.main.require('./src/user');
const db = require.main.require('./src/database');
const password = require.main.require('./src/password');
const emailer = require.main.require('./src/emailer');

const library = module.exports;

const getEmailDomain = email => email.substring(email.lastIndexOf("@") + 1);

async function getCompanyFromEmail(email) {
	const config = await meta.settings.get('anon');
	const domain = getEmailDomain(email);

	winston.info(JSON.stringify(config));
	const companyList = config['company-list'];
	for (const company of companyList) {
		if (domain === company.domain) {
			return company.name;
		}
	}
	return null;
}

library.init = async function (params) {
	const { router, middleware } = params;
	const routeHelpers = require.main.require('./src/routes/helpers');
	routeHelpers.setupAdminPageRoute(router, '/admin/plugins/anon', middleware, [], (req, res) => {
		res.render('admin/plugins/anon', {});
	});
};

library.addAdminNavigation = async function (header) {
	header.plugins.push({
		route: '/plugins/anon',
		icon: 'fa-paint-brush',
		name: 'Anon Theme',
	});
	return header;
};

library.defineWidgetAreas = async function (areas) {
	const locations = ['header', 'sidebar', 'footer'];
	const templates = [
		'categories.tpl', 'category.tpl', 'topic.tpl', 'users.tpl',
		'unread.tpl', 'recent.tpl', 'popular.tpl', 'top.tpl', 'tags.tpl', 'tag.tpl',
		'login.tpl', 'register.tpl',
	];
	function capitalizeFirst(str) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
	templates.forEach((template) => {
		locations.forEach((location) => {
			areas.push({
				name: `${capitalizeFirst(template.split('.')[0])} ${capitalizeFirst(location)}`,
				template: template,
				location: location,
			});
		});
	});

	areas = areas.concat([
		{
			name: 'Account Header',
			template: 'account/profile.tpl',
			location: 'header',
		},
	]);
	return areas;
};

library.getThemeConfig = async function (config) {
	const settings = await meta.settings.get('anon');
	config.hideSubCategories = settings.hideSubCategories === 'on';
	config.hideCategoryLastPost = settings.hideCategoryLastPost === 'on';
	config.enableQuickReply = settings.enableQuickReply === 'on';
	return config;
};

library.addUserToTopic = async function (hookData) {
	const settings = await meta.settings.get('anon');
	if (settings.enableQuickReply === 'on') {
		if (hookData.req.user) {
			const userData = await user.getUserData(hookData.req.user.uid);
			hookData.templateData.loggedInUser = userData;
		} else {
			hookData.templateData.loggedInUser = {
				uid: 0,
				username: '[[global:guest]]',
				picture: user.getDefaultAvatar(),
				'icon:text': '?',
				'icon:bgColor': '#aaa',
			};
		}
	}

	return hookData;
};

library.validateEmail = async (data) => {
	let allowed = data.allowed;
	let error = data.error;
	if (!await getCompanyFromEmail(data.email)) {
		allowed = false;
		error = '[[error:invalid-email-domain]]';
	}
	return { allowed, error };
}

library.addUserCompanyToPost = async (data) => {
	winston.info(`Getting userdata for ${data.uid}`);
	const userData = await user.getUserData(data.uid);
	winston.info(`Got user data: ${JSON.stringify(userData)}`);

	if (!userData) {
		throw new Error('[[error:no-user]]');
	}
	if (userData.company) {
		data.profile.push({ content: `<b>${userData.company}</b>` });
	}
	return data;
}

library.addCompanyToUserData = async (data) => {
	const user = data.user;
	user.company = await getCompanyFromEmail(user.email);
	return data;
}

library.whitelistCompanyField = async (data) => {
	data.whitelist.push('company');
	return data;
}

library.addCompanyToPostData = async (data) => {
	winston.info('Adding company field to posts fields...');
	data.fields.push('company');
	return data;
}

library.addCompanyToTopicUserFields = async (data) => {
	data.userFields.push('company');
	return data;
}

library.addCompanyToUsersFields = async (data) => {
	data.fields.push('company');
	return data;
}

library.sendAndHashConfirmationEmail = async (data) => {
	winston.info(`hashConfirmationemail got ${JSON.stringify(data)}`);
	const email = data.data.email.toLowerCase();
	const hashed = await password.hash(nconf.get('bcrypt_rounds') || 12, email);
	await db.setObjectField(`confirm:${data.data.confirm_code}`, 'email', hashed);
	await emailer.send(data.data.template, data.uid, data.data);
}

library.hashUserEmail = async (data) => {
	const userData = data.user;
	const email = userData.email.toLowerCase();
	winston.info(`got email ${email}`);

	const hashed = await password.hash(nconf.get('bcrypt_rounds') || 12, email);
	winston.info(`hashed = ${hashed}`);
	user.setUserField(userData.uid, 'email', hashed);
}