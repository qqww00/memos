package filter

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRenderKanbanBoardColumnEqualityPerDialect(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	cases := []struct {
		dialect  DialectName
		expected string
	}{
		{DialectSQLite, "JSON_EXTRACT(`memo`.`payload`, '$.kanban.boardId') = ?"},
		{DialectMySQL, "JSON_EXTRACT(`memo`.`payload`, '$.kanban.boardId') = ?"},
		{DialectPostgres, "memo.payload->'kanban'->>'boardId' = $1"},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), `kanban_board == "b1"`, RenderOptions{Dialect: tc.dialect})
		require.NoError(t, err, tc.dialect)
		require.Contains(t, stmt.SQL, tc.expected, tc.dialect)
		require.Equal(t, []any{"b1"}, stmt.Args, tc.dialect)
	}

	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), `kanban_column == "todo"`, RenderOptions{Dialect: tc.dialect})
		require.NoError(t, err, tc.dialect)
		switch tc.dialect {
		case DialectPostgres:
			require.Contains(t, stmt.SQL, "memo.payload->'kanban'->>'columnId' = $1", tc.dialect)
		default:
			require.Contains(t, stmt.SQL, "JSON_EXTRACT(`memo`.`payload`, '$.kanban.columnId') = ?", tc.dialect)
		}
		require.Equal(t, []any{"todo"}, stmt.Args, tc.dialect)
	}
}

func TestRenderKanbanPositionComparison(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	cases := []struct {
		dialect  DialectName
		expected string
	}{
		{DialectSQLite, "JSON_EXTRACT(`memo`.`payload`, '$.kanban.position') < ?"},
		{DialectMySQL, "JSON_EXTRACT(`memo`.`payload`, '$.kanban.position') < ?"},
		{DialectPostgres, "(memo.payload->'kanban'->>'position')::float8 < $1"},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), `kanban_position < 2.0`, RenderOptions{Dialect: tc.dialect})
		require.NoError(t, err, tc.dialect)
		require.Contains(t, stmt.SQL, tc.expected, tc.dialect)
		require.Equal(t, []any{2.0}, stmt.Args, tc.dialect)
	}
}

func TestRenderHasKanbanPresence(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	for _, dialect := range []DialectName{DialectSQLite, DialectMySQL, DialectPostgres} {
		stmt, err := engine.CompileToStatement(context.Background(), `has_kanban`, RenderOptions{Dialect: dialect})
		require.NoError(t, err, dialect)
		require.Contains(t, stmt.SQL, "kanban", dialect)

		stmt, err = engine.CompileToStatement(context.Background(), `!has_kanban`, RenderOptions{Dialect: dialect})
		require.NoError(t, err, dialect)
		require.Contains(t, stmt.SQL, "NOT", dialect)

		stmt, err = engine.CompileToStatement(context.Background(), `has_kanban == false`, RenderOptions{Dialect: dialect})
		require.NoError(t, err, dialect)

		require.Empty(t, stmt.Args, dialect)
	}
}

func TestRenderKanbanBoardAndColumnCombined(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	stmt, err := engine.CompileToStatement(
		context.Background(),
		`kanban_board == "b1" && kanban_column == "todo"`,
		RenderOptions{Dialect: DialectSQLite},
	)
	require.NoError(t, err)
	require.Contains(t, stmt.SQL, "$.kanban.boardId")
	require.Contains(t, stmt.SQL, "$.kanban.columnId")
	require.Equal(t, []any{"b1", "todo"}, stmt.Args)
}

func TestRenderKanbanColumnInList(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	stmt, err := engine.CompileToStatement(
		context.Background(),
		`kanban_column in ["todo", "doing"]`,
		RenderOptions{Dialect: DialectSQLite},
	)
	require.NoError(t, err)
	require.Contains(t, stmt.SQL, "$.kanban.columnId")
	require.Contains(t, stmt.SQL, "IN (?,?)")
	require.Equal(t, []any{"todo", "doing"}, stmt.Args)
}

func TestKanbanRejectsInvalidTypesAndOperators(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	_, err = engine.Compile(context.Background(), `kanban_board == 5`)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no matching overload")

	_, err = engine.Compile(context.Background(), `kanban_board < "a"`)
	require.Error(t, err)
	require.Contains(t, err.Error(), "not allowed")

	_, err = engine.Compile(context.Background(), `kanban_position == "x"`)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no matching overload")

	_, err = engine.Compile(context.Background(), `kanban_board`)
	require.Error(t, err)
	require.Contains(t, err.Error(), "is not boolean")

	_, err = engine.Compile(context.Background(), `has_kanban == "yes"`)
	require.Error(t, err)
}
