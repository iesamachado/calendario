#!/usr/bin/env node
/**
 * Script de migración: Backup + Migración a estructura multi-curso
 * 
 * ANTES DE EJECUTAR:
 *   npm install firebase-admin
 * 
 * EJECUCIÓN:
 *   node migrate.js
 * 
 * El script:
 *   1. Lee todas las colecciones de Firestore raíz
 *   2. Guarda un backup completo en ./backup_YYYYMMDD_HHMMSS/
 *   3. Escribe los datos de curso bajo /courses/2025-2026/
 *   4. Crea el documento settings/current_course
 *   5. Verifica los conteos finales
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs, { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

// ============================================================
// CONFIGURACIÓN
// ============================================================

// Descarga tu serviceAccountKey.json desde:
// Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

const NEW_COURSE_ID = '2025-2026';
const NEW_COURSE_LABEL = 'Curso 2025-2026';

// Colecciones que van DENTRO del curso (se migran a /courses/{id}/)
const COURSE_COLLECTIONS = [
    'availability',
    'tickets_tic',
    'tickets_maintenance',
    'tickets_3d',
    'sum_reservations',
    'cart_reservations',
    'announcements',
    'companies',
    'dual_students',
    'dual_interactions',
];

// Colecciones GLOBALES que NO se migran (se quedan en raíz)
const GLOBAL_COLLECTIONS = [
    'users',
    'departments',
    'login_logs',
    'carts',       // inventario de carros (global)
    'settings',    // settings globales (current_course, modules, etc.)
];

// ============================================================
// INIT
// ============================================================

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ============================================================
// HELPERS
// ============================================================

function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
}

async function readCollection(collectionName) {
    console.log(`  📖 Leyendo /${collectionName}...`);
    const snapshot = await db.collection(collectionName).get();
    const docs = {};
    snapshot.forEach(doc => {
        docs[doc.id] = doc.data();
    });
    console.log(`     → ${Object.keys(docs).length} documentos`);
    return docs;
}

async function writeCollection(collectionPath, docs) {
    const entries = Object.entries(docs);
    if (entries.length === 0) {
        console.log(`     → (vacío, saltando)`);
        return 0;
    }

    // Escribir en lotes de 400 (margen bajo el límite de 500 de Firestore)
    const BATCH_SIZE = 400;
    let written = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = entries.slice(i, i + BATCH_SIZE);

        for (const [docId, data] of chunk) {
            const ref = db.doc(`${collectionPath}/${docId}`);
            batch.set(ref, data);
        }

        await batch.commit();
        written += chunk.length;

        if (entries.length > BATCH_SIZE) {
            console.log(`     → Lote ${Math.floor(i/BATCH_SIZE) + 1}: ${written}/${entries.length} docs`);
        }
    }

    return written;
}

// ============================================================
// FASE 1: BACKUP
// ============================================================

async function backup(backupDir) {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║     FASE 1: BACKUP LOCAL                ║');
    console.log('╚══════════════════════════════════════════╝\n');

    mkdirSync(backupDir, { recursive: true });

    const allCollections = [...COURSE_COLLECTIONS, ...GLOBAL_COLLECTIONS];
    const allData = {};

    for (const col of allCollections) {
        try {
            const docs = await readCollection(col);
            allData[col] = docs;

            // Guardar cada colección como fichero JSON individual
            const filePath = join(backupDir, `${col}.json`);
            writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
        } catch (e) {
            console.warn(`  ⚠️  No se pudo leer /${col}: ${e.message}`);
            allData[col] = {};
        }
    }

    // Guardar también un fichero unificado
    const allPath = join(backupDir, '_ALL.json');
    writeFileSync(allPath, JSON.stringify(allData, null, 2), 'utf8');

    // Resumen
    console.log('\n📁 Backup guardado en:', backupDir);
    console.log('   Ficheros:');
    for (const col of allCollections) {
        const count = Object.keys(allData[col] || {}).length;
        console.log(`   • ${col}.json (${count} docs)`);
    }
    console.log(`   • _ALL.json (todo en uno)`);

    return allData;
}

// ============================================================
// FASE 2: MIGRACIÓN
// ============================================================

async function migrate(backupData) {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║     FASE 2: MIGRACIÓN A MULTI-CURSO     ║');
    console.log('╚══════════════════════════════════════════╝\n');

    console.log(`🎯 Curso destino: /courses/${NEW_COURSE_ID}/\n`);

    const results = {};

    // Migrar cada colección de curso bajo /courses/2025-2026/
    for (const col of COURSE_COLLECTIONS) {
        const docs = backupData[col] || {};
        const docCount = Object.keys(docs).length;
        console.log(`  📝 Migrando /${col} → /courses/${NEW_COURSE_ID}/${col} (${docCount} docs)`);

        try {
            const written = await writeCollection(`courses/${NEW_COURSE_ID}/${col}`, docs);
            results[col] = { original: docCount, migrated: written, ok: written === docCount };
        } catch (e) {
            console.error(`  ❌ Error migrando ${col}:`, e.message);
            results[col] = { original: docCount, migrated: 0, ok: false, error: e.message };
        }
    }

    // Migrar los contadores de tickets (settings/counters) al curso
    const settingsData = backupData['settings'] || {};
    if (settingsData['counters']) {
        console.log(`  📝 Migrando contadores de tickets al curso...`);
        const counterRef = db.doc(`courses/${NEW_COURSE_ID}/settings/counters`);
        await counterRef.set(settingsData['counters']);
        console.log(`     → Contadores migrados`);
    }

    // Migrar dual_config al curso
    if (settingsData['dual_config']) {
        console.log(`  📝 Migrando configuración dual al curso...`);
        const dualConfigRef = db.doc(`courses/${NEW_COURSE_ID}/settings/dual_config`);
        await dualConfigRef.set(settingsData['dual_config']);
        console.log(`     → Config dual migrada`);
    }

    return results;
}

// ============================================================
// FASE 3: CONFIGURAR SETTINGS DE CURSOS
// ============================================================

async function setupCourseSettings() {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║     FASE 3: CONFIGURAR SETTINGS         ║');
    console.log('╚══════════════════════════════════════════╝\n');

    // Crear el documento de curso actual
    console.log('  📋 Creando settings/current_course...');
    await db.doc('settings/current_course').set({
        courseId: NEW_COURSE_ID,
        label: NEW_COURSE_LABEL,
        createdAt: new Date(),
        archivedAt: null
    });

    // Crear la lista de cursos
    console.log('  📋 Creando settings/courses_list...');
    await db.doc('settings/courses_list').set({
        courses: [{
            id: NEW_COURSE_ID,
            label: NEW_COURSE_LABEL,
            isCurrent: true,
            createdAt: new Date().toISOString(),
            archivedAt: null
        }]
    });

    console.log('  ✅ Settings de cursos configurados');
}

// ============================================================
// FASE 4: VERIFICACIÓN
// ============================================================

async function verify(backupData, migrationResults) {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║     FASE 4: VERIFICACIÓN                ║');
    console.log('╚══════════════════════════════════════════╝\n');

    let allOk = true;

    console.log('  Colección                  | Original | Migrado | Estado');
    console.log('  ---------------------------|----------|---------|-------');

    for (const col of COURSE_COLLECTIONS) {
        const result = migrationResults[col];
        const status = result.ok ? '✅ OK' : '❌ ERROR';
        const colPadded = col.padEnd(26);
        const origPadded = String(result.original).padEnd(9);
        const migrPadded = String(result.migrated).padEnd(8);
        console.log(`  ${colPadded}| ${origPadded}| ${migrPadded}| ${status}`);
        if (!result.ok) allOk = false;
    }

    // Verificar settings
    const currentCourse = await db.doc('settings/current_course').get();
    const coursesList = await db.doc('settings/courses_list').get();
    console.log(`\n  settings/current_course    | ${currentCourse.exists ? '✅ Creado' : '❌ No existe'}`);
    console.log(`  settings/courses_list      | ${coursesList.exists ? '✅ Creado' : '❌ No existe'}`);

    if (allOk) {
        console.log('\n✅ MIGRACIÓN COMPLETADA CORRECTAMENTE\n');
        console.log('📌 Próximos pasos:');
        console.log('   1. Despliega el nuevo código de la intranet');
        console.log('   2. Actualiza las Firestore Security Rules');
        console.log(`   3. Los datos originales siguen en las colecciones raíz (puedes borrarlos más adelante)`);
        console.log(`   4. El backup está disponible en el directorio backup_*/`);
    } else {
        console.log('\n⚠️  MIGRACIÓN COMPLETADA CON ERRORES - Revisa los resultados arriba');
        console.log('   Los datos originales siguen intactos. Puedes repetir el script.');
    }

    return allOk;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  MIGRACIÓN MULTI-CURSO - IES Machado    ║');
    console.log(`║  Curso destino: ${NEW_COURSE_ID}               ║`);
    console.log('╚══════════════════════════════════════════╝');

    const timestamp = getTimestamp();
    const backupDir = `./backup_${timestamp}`;

    try {
        // FASE 1: Backup
        const backupData = await backup(backupDir);

        // Confirmación antes de migrar
        console.log('\n⚠️  ATENCIÓN: Se procederá con la migración en 5 segundos.');
        console.log(`   Backup guardado en: ${backupDir}`);
        console.log('   Los datos originales NO se borran automáticamente.');
        console.log('   Presiona Ctrl+C ahora para cancelar...\n');

        // Pausa de 5 segundos para que el usuario pueda cancelar
        await new Promise(resolve => setTimeout(resolve, 5000));

        // FASE 2: Migración
        const results = await migrate(backupData);

        // FASE 3: Settings
        await setupCourseSettings();

        // FASE 4: Verificación
        await verify(backupData, results);

    } catch (error) {
        console.error('\n❌ ERROR FATAL:', error);
        console.error('   Los datos originales están intactos.');
        process.exit(1);
    }

    process.exit(0);
}

main();
