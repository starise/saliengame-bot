// ==UserScript==
// @name         SalienGame Bot
// @namespace    https://github.com/starise/saliengame-bot
// @version      0.0.7
// @author       starise
// @match        *://steamcommunity.com/saliengame/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/starise/saliengame-bot/master/salienGameBot.user.js
// @updateURL    https://raw.githubusercontent.com/starise/saliengame-bot/master/salienGameBot.user.js
// ==/UserScript==

(function(context) {
const pixi = gApp;
const GAME = gGame;
const SERVER = gServer;
const SetMouse = function SetMouse(x, y) {
    pixi.renderer.plugins.interaction.mouse.global.x = x;
    pixi.renderer.plugins.interaction.mouse.global.y = y;
}
const EnemyManager = function EnemyManager() {
    return GAME.m_State.m_EnemyManager;
}
const AttackManager = function AttackManager() {
    return GAME.m_State.m_AttackManager;
}
const TryContinue = function Continue() {
    let continued = false;
    if (GAME.m_State.m_VictoryScreen) {
        GAME.m_State.m_VictoryScreen.children.forEach(function(child) {
            if (child.visible && child.x == 155 && child.y == 300) {// TODO: not this
                continued = true;
                child.pointertap();
            }
        })
    }
    if (GAME.m_State.m_LevelUpScreen) {
        continued = false;
        GAME.m_State.m_LevelUpScreen.children.forEach(function(child) {
            if (child.visible && child.x == 155 && child.y == 300) {// TODO: not this
                continued = true;
                child.pointertap();
            }
        })
    }
    return continued;
}
const CanAttack = function CanAttack(attackname) {
    let Manager = AttackManager().m_mapCooldowns.get(attackname);
    let lastUsed = Manager.m_rtAttackLastUsed;
    let canAttack = Manager.BAttack();
    Manager.m_rtAttackLastUsed = lastUsed;
    return canAttack;
}

// Let's challenge ourselves to be human here!
const CLICKS_PER_SECOND = 10;

const InGame = function InGame() {
    return GAME.m_State.m_bRunning;
}

const InZoneSelect = function InZoneSelect() {
    return GAME.m_State instanceof CBattleSelectionState;
}

const WORST_SCORE = -1 / 0;
const START_POS = pixi.renderer.width;

// context.lastZoneIndex;
let isJoining = false;

const EnemySpeed = function EnemySpeed(enemy) {
    return enemy.m_Sprite.vx;
}
const EnemyDistance = function EnemyDistance(enemy) {
    return (enemy.m_Sprite.x - k_nDamagePointx) / (START_POS - k_nDamagePointx);
}

const AimPoint = function AimPoint(enemy) {
    return [
        enemy.m_Sprite.x + enemy.m_Sprite.width / 2 + (EnemySpeed(enemy) * 20),
        enemy.m_Sprite.y + enemy.m_Sprite.height / 2
    ];
}


class Attack {
    constructor() {
        this.nextAttackDelta = 0;
    }
    shouldAttack(delta, enemies) {
        throw new Error("shouldAttack not implemented");
    }
    process(enemies) {
        throw new Error("process not implemented");
    }
    getAttackName() {
        throw new Error("no current attack name");
    }
    canAttack() {
        return CanAttack(this.getAttackName());
    }
    getAttackData() {
        return AttackManager().m_AttackData[this.getAttackName()];
    }
}

// Basic clicking attack, attack closest
class ClickAttack extends Attack {
    shouldAttack(delta) {
        // Can't do basic attack when station is down
        if (GAME.m_State.m_PlayerHealth <= 0)
            return false;
        this.nextAttackDelta -= delta;
        return this.nextAttackDelta <= 0;;
    }
    score(enemy) {
        if (enemy.m_bDead)
            return WORST_SCORE;
        return 1 - EnemyDistance(enemy);
    }
    process(enemies) {
        let target, target_score = WORST_SCORE;

        enemies.forEach((enemy) => {
            if (!enemy.m_Sprite.visible)
                return;
            let now_score = this.score(enemy);
            if (now_score > target_score) {
                target = enemy, target_score = now_score;
            }
        });

        if (target)
            this.attack(target);
    }
    attack(enemy) {
        enemy.m_Sprite.pointertap();
        this.nextAttackDelta = 1 / CLICKS_PER_SECOND;
    }
}

class ProjectileAttack extends Attack {
    shouldAttack(delta) {
        return CanAttack(this.getAttackName());
    }
    score(enemy) {
        if (enemy.m_bDead)
            return WORST_SCORE;
        return enemy.m_nHealth;
    }
    process(enemies) {
        let target, target_score = WORST_SCORE;

        enemies.forEach((enemy) => {
            if (!enemy.m_Sprite.visible)
                return;
            let now_score = this.score(enemy);
            if (now_score > target_score) {
                target = enemy, target_score = now_score;
            }
        });

        if (target)
            this.attack.apply(this, AimPoint(target));
    }
    attack(x, y) {
        SetMouse(x, y)
        AttackManager().m_mapKeyCodeToAttacks.get(this.getAttackData().keycode)()
    }
}

// the '1' button (SlimeAttack PsychicAttack BeastAttack - depends on body type of your salien)
class SpecialAttack extends ProjectileAttack {
    getAttackName() {
        if (gSalien.m_BodyType == "slime")
            return "slimeattack";
        else if (gSalien.m_BodyType == "beast")
            return "beastattack";
        else
            return "psychicattack";
    }
}

class BombAttack extends ProjectileAttack {
    getAttackName() {
        return "explosion";
    }
}
class BlackholeAttack extends ProjectileAttack {
    getAttackName() {
        return "blackhole";
    }
}
class MeteorAttack extends ProjectileAttack {
    getAttackName() {
        return "boulder";
    }
}

class FreezeAttack extends Attack {
    getCurrent() {
        return "flashfreeze";
    }
    shouldAttack(delta, enemies) {
        let shouldAttack = false;
        if (CanAttack(this.getCurrent())) {
            enemies.forEach((enemy) => {
                if (EnemyDistance(enemy) <= 0.05) {
                    shouldAttack = true;
                }
            });
        }
        return shouldAttack;
    }
    getData() {
        return AttackManager().m_AttackData[this.getCurrent()];
    }
    process() {
        AttackManager().m_mapKeyCodeToAttacks.get(this.getData().keycode)()
    }
}

let attacks = [
    new ClickAttack(),
    new SpecialAttack(),
    new FreezeAttack(),
    new BombAttack(),
    new BlackholeAttack(),
    new MeteorAttack()
]

if (context.BOT_FUNCTION) {
    pixi.ticker.remove(context.BOT_FUNCTION);
    context.BOT_FUNCTION = undefined;
}

context.BOT_FUNCTION = function ticker(delta) {
    delta /= 100;

    if(GAME.m_IsStateLoading) {
        return;
    }

    if (InZoneSelect() && context.lastZoneIndex !== undefined && !isJoining) {
        isJoining = true;

        if (GAME.m_State.m_PlanetData.zones[context.lastZoneIndex].captured)
        {
            context.lastZoneIndex = undefined;
            return;
        }

        SERVER.JoinZone(
            lastZoneIndex,
            function (results) {
                GAME.ChangeState(new CBattleState(GAME.m_State.m_PlanetData, context.lastZoneIndex));
            },
            GameLoadError
        );

        return;
    }
33
    if (!InGame()) {
        if (TryContinue()) {
            console.log("continued!");
        }
        return;
    }

    isJoining = false;
    context.lastZoneIndex = GAME.m_State.m_unZoneIndex;

    let state = EnemyManager();

    let enemies = state.m_mapEnemies;

    for (let attack of attacks)
        if (attack.shouldAttack(delta, enemies))
            attack.process(enemies);

}

pixi.ticker.add(context.BOT_FUNCTION);

})(window);
