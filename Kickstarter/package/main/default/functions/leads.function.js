const objectql = require("@steedos/objectql");
const core = require('@steedos/core');

const convertSettings = {
  "accounts": {
    "website": "website",
    "email": "email",
    "industry": "industry",
    "phone": "phone",
    "number_of_employees": "number_of_employees",
    "mobile": "mobilephone",
    "lead_source": "lead_source",
    "rating": "rating",
    "billing_address": "address"
  },
  "contacts": {
    "salutation": "salutation",
    "title": "title",
    "email": "email",
    "phone": "phone",
    "mobile": "mobilephone",
    "lead_source": "lead_source",
    "mailing_address": "address"
  },
  "opportunity": {
    "lead_source": "lead_source",
    "rating": "rating",
    "campaign_id": "campaign_id"
  }
};

const getDocConverts = (object_name, record) => {
  let result = {};
  const converts = Object.assign({}, convertSettings[object_name]);
  _.each(converts, (item, key) => {
    result[key] = record[item];
  });
  return result;
}

//Get the set of field values ​​whose corresponding key value is empty in oldDoc in docConverts,That is, the value in docConverts cannot overwrite and update the field value that already exists in oldDoc.
const getDocEmptyConverts = (docConverts, oldDoc) => {
  let result = {};
  _.each(docConverts, (item, key) => {
    if ((oldDoc[key] === undefined || oldDoc[key] === null || oldDoc[key] === 0) && item !== undefined && item !== null && item !== 0) {
      result[key] = item;
    }
  });
  return result;
}

//Calculate whether to create a new opportunity contact role and whether it is a new primary role
const getNewOpportunityContactRoleOptions = async (isLookupOpportunity, isLookupContact, recordOpportunity, recordContact, objOpportunityContactRole) => {
  let needAddOpportunityContactRole = false;
  let isPrimaryRole = false;
  if (isLookupOpportunity && isLookupContact) {
    // Opportunities and contacts are not new
    const roleRecords = await objOpportunityContactRole.find({
      filters: [["opportunity_id", "=", recordOpportunity._id]]
    });
    const repeatRoleRecord = roleRecords.find((item) => {
      return item.contact_id === recordContact._id;
    });
    if (!repeatRoleRecord) {
      // You only need to create a new contact role when there is no record for the same contact
      needAddOpportunityContactRole = true;
    }
    if (needAddOpportunityContactRole) {
      const primaryRoleRecord = roleRecords.find((item) => {
        return item.is_primary === true;
      });
      if (!primaryRoleRecord) {
        // Set the current role as the primary contact role only if there is no record with is_primary set to true
        isPrimaryRole = true;
      }
    }
  }
  else if (isLookupOpportunity) {
    //  It is a new contact, but not a new business opportunity.
    needAddOpportunityContactRole = true;
    const primaryCount = await objOpportunityContactRole.count({
      filters: [["opportunity_id", "=", recordOpportunity._id], ["is_primary", "=", true]]
    });
    if (primaryCount === 0) {
      // Set the current role as the primary contact role only if there is no record with is_primary set to true
      isPrimaryRole = true;
    }
  }
  else if (isLookupContact) {
    //  It is a new business opportunity, but not a new contact.
    needAddOpportunityContactRole = true;
    isPrimaryRole = true;
  }
  else {
    // are new opportunities and contacts
    needAddOpportunityContactRole = true;
    isPrimaryRole = true;
  }
  return {
    needAddOpportunityContactRole,
    isPrimaryRole
  }
}

const validateBody = (body, recordAccount, recordContact, recordOpportunity) => {
  let validateResult = {};
  if (body.is_lookup_account && !body.lookup_account) {
    validateResult.error = "Please enter "New Customer Name" or select "Existing Customer"!";
  }
  else if (!body.is_lookup_account && !body.new_account_name) {
    validateResult.error = "Please enter "New Customer Name" or select "Existing Customer"!";
  }
  else if (body.is_lookup_contact && !body.lookup_contact) {
    validateResult.error = "Please enter "New Contact Name" or select "Existing Contact"!";
  }
  else if (!body.is_lookup_contact && !body.new_contact_name) {
    validateResult.error = "Please enter "New Contact Name" or select "Existing Contact"!";
  }
  else if (!body.omit_new_opportunity) {
    if (body.is_lookup_opportunity && !body.lookup_opportunity) {
      validateResult.error = "Please select "Existing Opportunity" or check the "Do not create opportunities during conversion" item!";
    }
    else if (!body.is_lookup_opportunity && !body.new_opportunity_name) {
      validateResult.error = "Please enter the "New Business Opportunity Name" or check the "Do not create business opportunities during conversion" item!";
    }
  }
  if(!validateResult.error && recordAccount){
    if(recordContact && recordContact.account && recordContact.account !== recordAccount._id){
      validateResult.error = "The existing contact must be a contact under an existing customer!";
    }
    else if(recordOpportunity && recordOpportunity.account && recordOpportunity.account !== recordAccount._id){
      validateResult.error = "Existing business opportunities must be business opportunities under existing customers!";
    }
  }
  return validateResult;
}

module.exports = {
  convert: async function (req, res) {
    try {
      const params = req.params;
      const recordId = params._id;
      const userSession = req.user;
      req.body.new_account_name = req.body.new_account_name && req.body.new_account_name.trim();
      req.body.new_contact_name = req.body.new_contact_name && req.body.new_contact_name.trim();
      req.body.new_opportunity_name = req.body.new_opportunity_name && req.body.new_opportunity_name.trim();
      const body = req.body;
      const steedosSchema = objectql.getSteedosSchema();
      const objAccounts = steedosSchema.getObject('accounts');
      const objContacts = steedosSchema.getObject('contacts');
      const objOpportunity = steedosSchema.getObject('opportunity');
      let recordAccount, recordContact, recordOpportunity;
      if (body.is_lookup_account && body.lookup_account) {
        recordAccount = await objAccounts.findOne(body.lookup_account);
        if (!recordAccount) {
          return res.status(500).send({
            "error": "Action Failed -- The account is not found.",
            "success": false
          });
        }
      }
      if (body.is_lookup_contact && body.lookup_contact) {
        recordContact = await objContacts.findOne(body.lookup_contact);
        if (!recordContact) {
          return res.status(500).send({
            "error": "Action Failed -- The contact is not found.",
            "success": false
          });
        }
      }
      if (!body.omit_new_opportunity && body.is_lookup_opportunity && body.lookup_opportunity) {
        recordOpportunity = await objOpportunity.findOne(body.lookup_opportunity);
        if (!recordOpportunity) {
          return res.status(500).send({
            "error": "Action Failed -- The opportunity is not found.",
            "success": false
          });
        }
      }
      const validateResult = validateBody(body, recordAccount, recordContact, recordOpportunity);
      if (validateResult && validateResult.error) {
        return res.status(500).send({
          "error": validateResult.error,
          "success": false
        });
      }
      let new_account_name = body.new_account_name;
      let new_contact_name = body.new_contact_name;
      let new_opportunity_name = body.new_opportunity_name;
      const objLeads = steedosSchema.getObject('leads');
      const record = await objLeads.findOne(recordId);
      const docAccountConverts = getDocConverts("accounts", record);
      const docContactConverts = getDocConverts("contacts", record);
      const docOpportunityConverts = getDocConverts("opportunity", record);
      let docLeadUpdate = { converted: true, status: "Qualified" };
      const baseDoc = { owner: body.record_owner_id, space: userSession.spaceId };
      if (body.is_lookup_account && body.lookup_account) {
         // All field attributes are updated synchronously when they are empty
        const docAccountEmptyConverts = getDocEmptyConverts(docAccountConverts, recordAccount);
        if (!_.isEmpty(docAccountEmptyConverts)) {
          await objAccounts.updateOne(recordAccount._id, docAccountEmptyConverts, userSession);
        }
      }
      else {
        recordAccount = await objAccounts.insert(Object.assign({}, baseDoc, docAccountConverts, { name: new_account_name }), userSession);
        if (!recordAccount) {
          return res.status(500).send({
            "error": "Action Failed -- Insert account failed.",
            "success": false
          });
        }
      }
      if (recordAccount) {
        docLeadUpdate.converted_account = recordAccount._id;
        if (body.is_lookup_contact && body.lookup_contact) {
          //  Including the customer, all field attributes are updated synchronously if they are empty.
          let docContactEmptyConverts = getDocEmptyConverts(Object.assign({}, docContactConverts, { account: recordAccount._id }), recordContact);
          if (body.force_update_contact_lead_source && !docContactEmptyConverts.lead_source && docContactConverts.lead_source) {
            // If "Update lead source" is checked on the interface, the contact's lead source should be forcibly updated.
            docContactEmptyConverts.lead_source = docContactConverts.lead_source;
          }
          if (!_.isEmpty(docContactEmptyConverts)) {
            await objContacts.updateOne(recordContact._id, docContactEmptyConverts, userSession);
          }
        }
        else {
          recordContact = await objContacts.insert(Object.assign({}, baseDoc, docContactConverts, { name: new_contact_name, account: recordAccount._id }), userSession);
          if (!recordContact) {
            return res.status(500).send({
              "error": "Action Failed -- Insert contact failed.",
              "success": false
            });
          }
        }
        if (recordContact) {
          docLeadUpdate.converted_contact = recordContact._id;
          if (!body.omit_new_opportunity) {
            if (body.is_lookup_opportunity && body.lookup_opportunity) {
              // Including the customer, all field attributes are updated synchronously if they are empty.
              const docOpportunityEmptyConverts = getDocEmptyConverts(Object.assign({}, docOpportunityConverts, { account: recordAccount._id }), recordOpportunity);
              if (!_.isEmpty(docOpportunityEmptyConverts)) {
                await objOpportunity.updateOne(recordOpportunity._id, docOpportunityEmptyConverts, userSession);
              }
            }
            else {
              recordOpportunity = await objOpportunity.insert(Object.assign({}, baseDoc, docOpportunityConverts, { name: new_opportunity_name, account: recordAccount._id }), userSession);
              if (!recordOpportunity) {
                return res.status(500).send({
                  "error": "Action Failed -- Insert opportunity failed.",
                  "success": false
                });
              }
            }
            if (recordOpportunity) {
              docLeadUpdate.converted_opportunity = recordOpportunity._id;
              const objOpportunityContactRole = steedosSchema.getObject('opportunity_contact_role');
              const { needAddOpportunityContactRole, isPrimaryRole } = await getNewOpportunityContactRoleOptions(body.is_lookup_opportunity, body.is_lookup_contact, recordOpportunity, recordContact, objOpportunityContactRole);
              if (needAddOpportunityContactRole) {
                await objOpportunityContactRole.insert(Object.assign({}, baseDoc, { opportunity_id: recordOpportunity._id, contact_id: recordContact._id, is_primary: isPrimaryRole }), userSession);
              }
            }
          }
        }
      }
      await objLeads.updateOne(recordId, docLeadUpdate, userSession);
      return res.status(200).send({ state: 'SUCCESS' });
    } catch (error) {
      console.error(error);
      return core.sendError(res, error, 400);
    }
  }
}