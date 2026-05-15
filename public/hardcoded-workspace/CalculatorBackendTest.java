public class CalculatorBackendTest {
    public static void main(String[] args) {
        assertSuccess(3.0, new CalculatorBackend.CalculationRequest(1.0, "+", 2.0));
        assertSuccess(-1.0, new CalculatorBackend.CalculationRequest(1.0, "-", 2.0));
        assertSuccess(6.0, new CalculatorBackend.CalculationRequest(3.0, "*", 2.0));
        assertSuccess(2.5, new CalculatorBackend.CalculationRequest(5.0, "/", 2.0));

        assertError("DIVISION_BY_ZERO", new CalculatorBackend.CalculationRequest(5.0, "/", 0.0));
        assertError("INVALID_OPERATOR", new CalculatorBackend.CalculationRequest(5.0, "%", 2.0));
        assertError("INVALID_INPUT", new CalculatorBackend.CalculationRequest(null, "+", 2.0));
        assertError("INVALID_INPUT", new CalculatorBackend.CalculationRequest(1.0, "+", null));

        CalculatorBackend.CalculationRequest parsed = CalculatorBackend.parseRequest("{\"left\":10,\"operator\":\"/\",\"right\":4}");
        assertSuccess(2.5, parsed);

        assertEquals("{\"success\":true,\"result\":2.5}", CalculatorBackend.successJson(2.5));
        assertEquals("{\"success\":false,\"error\":{\"code\":\"DIVISION_BY_ZERO\",\"message\":\"Cannot divide by zero.\"}}",
                CalculatorBackend.errorJson("DIVISION_BY_ZERO", "Cannot divide by zero."));

        System.out.println("CalculatorBackendTest passed");
    }

    private static void assertSuccess(double expected, CalculatorBackend.CalculationRequest request) {
        CalculatorBackend.CalculationResponse response = CalculatorBackend.calculate(request);
        if (!response.success) {
            throw new AssertionError("Expected success but got error: " + response.errorCode + " - " + response.errorMessage);
        }
        if (Math.abs(expected - response.result) > 0.0000001) {
            throw new AssertionError("Expected " + expected + " but got " + response.result);
        }
    }

    private static void assertError(String expectedCode, CalculatorBackend.CalculationRequest request) {
        CalculatorBackend.CalculationResponse response = CalculatorBackend.calculate(request);
        if (response.success) {
            throw new AssertionError("Expected error " + expectedCode + " but got success: " + response.result);
        }
        assertEquals(expectedCode, response.errorCode);
    }

    private static void assertEquals(String expected, String actual) {
        if (!expected.equals(actual)) {
            throw new AssertionError("Expected [" + expected + "] but got [" + actual + "]");
        }
    }
}
