#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env,
};

fn setup() -> (Env, Address, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|ledger| ledger.timestamp = 1_700_000_000);

    let admin = Address::generate(&env);
    let customer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_id.address();
    StellarAssetClient::new(&env, &token_address).mint(&customer, &100_000_000);

    let contract_id = env.register(
        EnzaCheckout,
        (admin.clone(), token_address.clone(), merchant.clone()),
    );
    (env, contract_id, admin, customer, merchant, token_address)
}

#[test]
fn order_is_paid_once_and_transfers_exact_amount() {
    let (env, contract_id, _admin, customer, merchant, token_address) = setup();
    let client = EnzaCheckoutClient::new(&env, &contract_id);
    let order_id = BytesN::from_array(&env, &[7; 32]);
    client.create_order(&order_id, &25_000_000, &(env.ledger().timestamp() + 900));

    let token = TokenClient::new(&env, &token_address);
    let before = token.balance(&customer);
    client.pay_order(&order_id, &customer);

    assert_eq!(before - token.balance(&customer), 25_000_000);
    assert_eq!(token.balance(&merchant), 25_000_000);
    assert!(client.get_order(&order_id).unwrap().paid);
    assert_eq!(client.get_order(&order_id).unwrap().customer, Some(customer.clone()));

    assert_eq!(
        client.try_pay_order(&order_id, &customer),
        Err(Ok(Error::AlreadyPaid))
    );
    assert_eq!(token.balance(&merchant), 25_000_000);
}

#[test]
fn rejects_zero_amount_and_expired_order() {
    let (env, contract_id, _admin, customer, _merchant, _token) = setup();
    let client = EnzaCheckoutClient::new(&env, &contract_id);
    let zero_id = BytesN::from_array(&env, &[8; 32]);
    assert_eq!(
        client.try_create_order(&zero_id, &0, &(env.ledger().timestamp() + 900)),
        Err(Ok(Error::InvalidAmount))
    );

    let expired_id = BytesN::from_array(&env, &[9; 32]);
    client.create_order(&expired_id, &1_000, &(env.ledger().timestamp() + 1));
    env.ledger().with_mut(|ledger| ledger.timestamp += 2);
    assert_eq!(
        client.try_pay_order(&expired_id, &customer),
        Err(Ok(Error::OrderExpired))
    );
}

#[test]
fn rejects_duplicate_order_ids() {
    let (env, contract_id, _admin, _customer, _merchant, _token) = setup();
    let client = EnzaCheckoutClient::new(&env, &contract_id);
    let order_id = BytesN::from_array(&env, &[10; 32]);
    let expiry = env.ledger().timestamp() + 900;
    client.create_order(&order_id, &1_000, &expiry);
    assert_eq!(
        client.try_create_order(&order_id, &2_000, &expiry),
        Err(Ok(Error::OrderAlreadyExists))
    );
}
