Steedos.CRM = {};

Steedos.CRM.showLeadConvertForm = function (fields, formId, doc, onConfirm, title) {
    var schema = Creator.getObjectSchema({ fields: fields });
    Modal.show("quickFormModal", { formId: formId, title: title || " Convert leads", confirmBtnText: `Convert`, schema: schema, autoExpandGroup: true, doc: doc, onConfirm: onConfirm }, {
        backdrop: 'static',
        keyboard: true
    });
}

Steedos.CRM.convertLead = function (record) {
    if (record.converted) {
        toastr.error(t("This potential customer has already been converted and cannot be converted again！"));
        return;
    }
    const record_id = record._id;
    const object_name = "leads";
    let doc = {};
    doc.new_account_name = record.company;
    doc.new_contact_name = record.name;
    doc.new_opportunity_name = `${doc.new_account_name}-`;
    doc.omit_new_opportunity = false;
    doc.record_owner_id = Steedos.userId();
    var formId = 'leadConvertForm';
    Steedos.CRM.showLeadConvertForm({
        new_account_name: {
            label: "Create new customer name",
            type: 'text',
            is_wide: true,
            group: "client"
        },
        is_lookup_account: {
            label: "Select existing",
            type: 'toggle',
            group: "client"
        },
        lookup_account: {
            label: "Existing customers",
            type: 'lookup',
            reference_to: 'accounts',
            group: "client"
        },
        new_contact_name: {
            label: "Create new contact name",
            type: 'text',
            is_wide: true,
            group: "Contact person"
        },
        is_lookup_contact: {
            label: "Select existing",
            type: 'toggle',
            group: "Contact person"
        },
        lookup_contact: {
            label: "Existing contacts",
            type: 'lookup',
            reference_to: 'contacts',
            depend_on: ["is_lookup_contact", "is_lookup_account", "lookup_account"],
            optionsFunction: function (values) {
                let { is_lookup_contact, is_lookup_account, lookup_account } = values;
                if (!is_lookup_contact) {
                    return [];
                }
                let options = {
                    $select: 'name'
                };
                let queryFilters = [["account", "=", null]];
                if (is_lookup_account && lookup_account) {
                    queryFilters.push("or");
                    queryFilters.push(["account", "=", lookup_account]);
                }
                let steedosFilters = require("@steedos/filters");
                let odataFilter = steedosFilters.formatFiltersToODataQuery(queryFilters);
                options.$filter = odataFilter;
                let records = Creator.odata.query('contacts', options, true);
                let result = [];
                records.forEach(function (item) {
                    result.push({
                        label: item.name,
                        value: item._id
                    });
                });
                return result;
            },
            group: "Contact person"
        },
        force_update_contact_lead_source: {
            label: "Update lead sources",
            type: 'toggle',
            group: "Contact person"
        },
        new_opportunity_name: {
            label: "Create a new opportunity name",
            type: 'text',
            is_wide: true,
            group: "business opportunities"
        },
        is_lookup_opportunity: {
            label: "Select existing",
            type: 'toggle',
            group: "business opportunities"
        },
        lookup_opportunity: {
            label: "Existing business opportunities",
            type: 'lookup',
            reference_to: 'opportunity',
            depend_on: ["is_lookup_opportunity", "is_lookup_account", "lookup_account"],
            optionsFunction: function (values) {
                let { is_lookup_opportunity, is_lookup_account, lookup_account } = values;
                if (!is_lookup_opportunity) {
                    return [];
                }
                let options = {
                    $select: 'name'
                };
                let queryFilters = [["account", "=", null]];
                if (is_lookup_account && lookup_account) {
                    queryFilters.push("or");
                    queryFilters.push(["account", "=", lookup_account]);
                }
                let steedosFilters = require("@steedos/filters");
                let odataFilter = steedosFilters.formatFiltersToODataQuery(queryFilters);
                options.$filter = odataFilter;
                let records = Creator.odata.query('opportunity', options, true);
                let result = [];
                records.forEach(function (item) {
                    result.push({
                        label: item.name,
                        value: item._id
                    });
                });
                return result;
            },
            group: "business opportunities"
        },
        omit_new_opportunity: {
            label: "Don't create opportunities on conversion",
            type: 'toggle',
            group: "business opportunities"
        },
        record_owner_id: {
            label: "Record owner",
            type: 'lookup',
            reference_to: 'users',
            required: true,
            group: "other"
        }
    }, formId, doc, function (formValues, e, t) {
        let insertDoc = formValues.insertDoc;
        var result = Steedos.authRequest(`/api/v4/${object_name}/${record_id}/convert`, { type: 'post', async: false, data: JSON.stringify(insertDoc) });
        if (result && result.state === 'SUCCESS') {
            FlowRouter.reload();
            Modal.hide(t);
            Steedos.CRM.alertLeadConvertedRecords(record);
        }
    })
}

Steedos.CRM.alertLeadConvertedRecords = function (record) {
    const record_id = record._id;
    const object_name = "leads";
    const fields = "converted_account,converted_contact,converted_opportunity";
    // Note that two fields parameters are passed in here. The second one is expand and cannot be deleted.
    const converteds = Creator.odata.get(object_name, record_id, fields, fields);
    let doc = {};
    if (converteds.converted_account) {
        doc.account_name = converteds.converted_account._NAME_FIELD_VALUE;
        doc.account_url = Creator.getObjectAbsoluteUrl("accounts", converteds.converted_account._id);
    }
    if (converteds.converted_contact) {
        doc.contact_name = converteds.converted_contact._NAME_FIELD_VALUE;
        doc.contact_url = Creator.getObjectAbsoluteUrl("contacts", converteds.converted_contact._id);
    }
    if (converteds.converted_opportunity) {
        doc.opportunity_name = converteds.converted_opportunity._NAME_FIELD_VALUE;
        doc.opportunity_url = Creator.getObjectAbsoluteUrl("opportunity", converteds.converted_opportunity._id);
    }
    let html = `
        <div class="grid grid-cols-1 lg:gap-2">
            <div class="flex items-start">
                <div class="ml-4">
                    <p class="text-gray-900"><span>client：<span><a href="${doc.account_url}" target="_blank">${doc.account_name ? doc.account_name : ""}</a></p>
                </div>
            </div>
            <div class="flex items-start">
                <div class="ml-4">
                    <p class="text-gray-900"><span>Contact person：<span><a href="${doc.contact_url}" target="_blank">${doc.contact_name ? doc.contact_name : ""}</a></p>
                </div>
            </div>
            <div class="flex items-start">
                <div class="ml-4">
                    <p class="text-gray-900"><span>business opportunities：<span><a href="${doc.opportunity_url}" target="_blank">${doc.opportunity_name ? doc.opportunity_name : ""}</a></p>
                </div>
            </div>
        </div>
    `;
    swal({
        title: "Lead converted",
        text: html,
        html: true,
        type: "success",
        confirmButtonText: t('OK')
    },
        () => {
            sweetAlert.close();
        }
    );
}