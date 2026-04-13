module quantum::trading {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::clock::{Self, Clock};

    /// Error codes
    const E_INSUFFICIENT_FUNDS: u64 = 0;
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_TRADE_TOO_LARGE: u64 = 2;
    const E_INVALID_AMOUNT: u64 = 3;
    const E_COOLDOWN_ACTIVE: u64 = 4;
    const E_DAILY_LOSS_EXCEEDED: u64 = 5;
    const E_CIRCUIT_BREAKER_TRIGGERED: u64 = 6;
    const E_EXPOSURE_TOO_HIGH: u64 = 7;
    const E_TRADE_TOO_SMALL: u64 = 8;
    const E_SLIPPAGE_EXCEEDED: u64 = 9;

    const MIN_TRADE_SIZE: u64 = 1_000_000; // Minimum 0.001 SUI Trade Size
    const ONE_DAY_MS: u64 = 86_400_000; // 24 hours in ms

    /// The global pool holding platform fees
    struct ProtocolTreasury has key {
        id: UID,
        fees_collected: Balance<SUI>
    }

    /// Represents a user`s trading session (held non-custodially)
    struct TradingSession has key, store {
        id: UID,
        owner: address,
        principal: Balance<SUI>,
        is_active: bool,
        start_time: u64,
        
        // --- ON-CHAIN RISK ENGINE FIELDS ---
        max_trade_size: u64,
        max_daily_loss: u64,
        daily_loss: u64,
        total_exposure: u64,
        last_trade_timestamp: u64,
        trade_count: u64,
        circuit_breaker_active: bool,
        daily_reset_timestamp: u64,
    }

    /// Admin capability for platform ops
    struct AdminCap has key { id: UID }

    fun init(ctx: &mut TxContext) {
        transfer::transfer(AdminCap { id: object::new(ctx) }, tx_context::sender(ctx));
        transfer::share_object(ProtocolTreasury {
            id: object::new(ctx),
            fees_collected: balance::zero(),
        });
    }

    /// User deposits SUI to start trades
    public entry fun start_session(
        payment: &mut Coin<SUI>,
        amount: u64,
        max_trade_size: u64,
        max_daily_loss: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(amount >= 1000000000, E_INVALID_AMOUNT); // Min 1 SUI deposit
        assert!(coin::value(payment) >= amount, E_INSUFFICIENT_FUNDS);

        let principal = coin::into_balance(coin::take(coin::balance_mut(payment), amount, ctx));
        let now = clock::timestamp_ms(clock);
        
        let session = TradingSession {
            id: object::new(ctx),
            owner: sender,
            principal,
            is_active: true,
            start_time: now,
            
            max_trade_size,
            max_daily_loss,
            daily_loss: 0,
            total_exposure: 0,
            last_trade_timestamp: 0,
            trade_count: 0,
            circuit_breaker_active: false,
            daily_reset_timestamp: now + ONE_DAY_MS,
        };

        transfer::share_object(session);
    }

    /// Core Risk Engine guard enforcing PTB boundaries
    public entry fun execute_trade_guard(
        session: &mut TradingSession,
        trade_amount: u64,
        actual_output: u64,
        min_expected_output: u64,
        is_loss: bool,
        loss_amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(session.owner == sender, E_NOT_AUTHORIZED);
        assert!(session.is_active, E_NOT_AUTHORIZED);
        
        let now = clock::timestamp_ms(clock);

        // 7. RESET DAILY LIMITS (TIME-BASED)
        if (now > session.daily_reset_timestamp) {
            session.daily_loss = 0;
            session.trade_count = 0;
            session.circuit_breaker_active = false; // Reset circuit breaker daily
            session.daily_reset_timestamp = now + ONE_DAY_MS;
        };

        // 6. CIRCUIT BREAKER
        assert!(!session.circuit_breaker_active, E_CIRCUIT_BREAKER_TRIGGERED);

        // 9. ENFORCE MINIMUM TRADE SIZE
        assert!(trade_amount >= MIN_TRADE_SIZE, E_TRADE_TOO_SMALL);

        // 2. ENFORCE MAX TRADE SIZE
        assert!(trade_amount <= session.max_trade_size, E_TRADE_TOO_LARGE);

        // 8. ENFORCE TOTAL EXPOSURE LIMIT
        let balance_val = balance::value(&session.principal);
        assert!(session.total_exposure + trade_amount <= balance_val, E_EXPOSURE_TOO_HIGH);

        // 5. COOLDOWN ENFORCEMENT
        assert!(now > session.last_trade_timestamp + 60000, E_COOLDOWN_ACTIVE);
        session.last_trade_timestamp = now;

        // 10. SLIPPAGE PROTECTION (CRITICAL)
        assert!(actual_output >= min_expected_output, E_SLIPPAGE_EXCEEDED);

        // 4. TRACK LOSS ON EVERY TRADE
        if (is_loss) {
            session.daily_loss = session.daily_loss + loss_amount;
        };

        // 3. ENFORCE DAILY LOSS LIMIT AND CIRCUIT BREAKER UPDATE
        if (session.daily_loss >= session.max_daily_loss) {
            session.circuit_breaker_active = true;
        };
        assert!(session.daily_loss <= session.max_daily_loss, E_DAILY_LOSS_EXCEEDED);

        // 11. UPDATE TRADE STATE
        session.total_exposure = session.total_exposure + trade_amount;
        session.trade_count = session.trade_count + 1;
    }

    public entry fun withdraw_session(
        session: &mut TradingSession,
        treasury: &mut ProtocolTreasury,
        ctx: &mut TxContext
    ) {
        assert!(session.owner == tx_context::sender(ctx), E_NOT_AUTHORIZED);
        let total_val = balance::value(&session.principal);
        assert!(total_val > 0, E_INVALID_AMOUNT);

        let fee_val = total_val / 1000; // 0.1% platform fee (matches TypeScript PLATFORM_FEE_PERCENT = 0.001)
        let payout_val = total_val - fee_val;

        let fee_balance = balance::split(&mut session.principal, fee_val);
        balance::join(&mut treasury.fees_collected, fee_balance);

        let payout_coin = coin::take(&mut session.principal, payout_val, ctx);
        transfer::public_transfer(payout_coin, tx_context::sender(ctx));

        session.is_active = false;
        // Optionally reset constraints
        session.total_exposure = 0;
        session.daily_loss = 0;
    }
}
