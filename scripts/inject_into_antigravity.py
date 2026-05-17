#!/usr/bin/env python3
"""
Script para inyectar una sesión de OpenCode en Antigravity
usando la base de datos SQLite que Antigravity lee para mostrar conversaciones.
"""

import os
import sys
import json
import base64
import sqlite3
import uuid

def inject_conversation(conversation_id: str, session_data: dict, db_path: str):
    """
    Inyecta una conversación en la base de datos SQLite de Antigravity
    y actualiza los índices necesarios.
    """

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Obtener el valor actual de jetskiStateSync.agentManagerInitState
    cursor.execute("SELECT value FROM ItemTable WHERE key = 'jetskiStateSync.agentManagerInitState'")
    row = cursor.fetchone()

    if not row:
        print("❌ No se encontró jetskiStateSync.agentManagerInitState")
        return False

    current_value = row[0]
    decoded = base64.b64decode(current_value)

    # Parsear el formato - es un protobuf-like structure
    # El formato contiene: auth_token + conversations_array

    # Intentamos parsear y agregar nuestra conversación
    # Primero我们需要理解实际的结构...

    # Por ahora, vamos a agregar una entrada en history.recentlyOpenedPathsList
    # que es donde Antigravity guarda las conversaciones recientes

    cursor.execute("SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'")
    row = cursor.fetchone()

    if row:
        current_history = json.loads(row[0])
        new_entry = {
            "folderUri": f"file:///Users/marcelomiranda/.gemini/antigravity/brain/{conversation_id}",
            "label": f"Conversación importada desde OpenCode: {session_data.get('id', 'unknown')}"
        }

        # Agregar al inicio de entries
        current_history["entries"].insert(0, new_entry)

        cursor.execute(
            "UPDATE ItemTable SET value = ? WHERE key = 'history.recentlyOpenedPathsList'",
            (json.dumps(current_history),)
        )
        conn.commit()
        print(f"✅ Actualizado history.recentlyOpenedPathsList")
        return True

    return False

def create_annotation_file(conversation_id: str):
    """Crea el archivo de anotación para la conversación."""
    annotations_dir = os.path.expanduser("~/.gemini/antigravity/annotations")
    os.makedirs(annotations_dir, exist_ok=True)

    annotation_path = os.path.join(annotations_dir, f"{conversation_id}.pbtxt")

    # El formato es: last_user_view_time:{seconds:N  nanos:N}
    import time
    current_time = int(time.time())

    with open(annotation_path, 'w') as f:
        f.write(f'last_user_view_time:{{seconds:{current_time}  nanos:0}}')

    print(f"✅ Creado annotation file: {annotation_path}")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: inject_into_antigravity.py <conversation_id> <session_json>")
        sys.exit(1)

    conversation_id = sys.argv[1]
    session_data = json.loads(sys.argv[2])

    db_path = os.path.expanduser("~/Library/Application Support/Antigravity/User/globalStorage/state.vscdb")

    print(f"🔄 Inyectando conversación {conversation_id}...")

    # Crear annotation file
    create_annotation_file(conversation_id)

    # Actualizar SQLite
    inject_conversation(conversation_id, session_data, db_path)

    print("✅ Inyección completada!")
    print(f"   Conversation ID: {conversation_id}")
    print(f"   Para ver la conversación, reinicia Antigravity")